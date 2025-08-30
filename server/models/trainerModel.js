// models/trainerModel.js - Trainer Model
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const trainerSchema = new mongoose.Schema({
  trainerId: {
    type: String,
    required: [true, 'Trainer ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Trainer name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // do not return password in queries by default
  },
  contact: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  specializationSkills: {
    type: [String],
    default: []
  },
  experiences: [{
    title: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    years: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true }
  }],
  education: [{
    degree: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    yearOfCompletion: { type: Number }
  }],
  ratings: {
    average: { type: Number, min: 0, max: 5, default: 0 },
    totalRatings: { type: Number, default: 0 }
  },
  reviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'trainers'
});

// Compound index for searching by name + skills
trainerSchema.index({ name: 1, specializationSkills: 1 }, { name: 'name_skills_index' });

/* ========= Virtuals ========= */
trainerSchema.virtual('experienceYears').get(function() {
  if (!this.experiences || this.experiences.length === 0) return 0;
  return this.experiences.reduce((sum, exp) => sum + (exp.years || 0), 0);
});

trainerSchema.virtual('highestEducation').get(function() {
  if (!this.education || this.education.length === 0) return null;
  return this.education.reduce((latest, edu) =>
    !latest || (edu.yearOfCompletion > latest.yearOfCompletion) ? edu : latest
  , null);
});

/* ========= Middleware ========= */
// Hash password before saving
trainerSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  this.updatedAt = new Date();

  // Clean up skills
  if (this.specializationSkills && Array.isArray(this.specializationSkills)) {
    this.specializationSkills = this.specializationSkills
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);
  }

  next();
});

/* ========= Methods ========= */
// Compare passwords for login
trainerSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add skill
trainerSchema.methods.addSkill = function(skill) {
  if (!this.specializationSkills.includes(skill.trim())) {
    this.specializationSkills.push(skill.trim());
  }
  return this.save();
};

// Remove skill
trainerSchema.methods.removeSkill = function(skill) {
  this.specializationSkills = this.specializationSkills.filter(s => s !== skill.trim());
  return this.save();
};

// Add experience
trainerSchema.methods.addExperience = function(experienceData) {
  this.experiences.push(experienceData);
  return this.save();
};

// Add education
trainerSchema.methods.addEducation = function(educationData) {
  this.education.push(educationData);
  return this.save();
};

// Add review & update rating
trainerSchema.methods.addReview = function(userId, rating, comment) {
  this.reviews.push({ userId, rating, comment });
  this.ratings.totalRatings += 1;
  this.ratings.average =
    this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length;
  return this.save();
};

/* ========= Static Methods ========= */
trainerSchema.statics.findBySkill = function(skill) {
  return this.find({ specializationSkills: skill }).sort({ updatedAt: -1 });
};

trainerSchema.statics.findByName = function(name) {
  return this.find({ name: new RegExp(name, 'i') }); // case-insensitive
};

/* ========= Settings ========= */
trainerSchema.set('toJSON', { virtuals: true });
trainerSchema.set('toObject', { virtuals: true });

const Trainer = mongoose.model('Trainer', trainerSchema);
export default Trainer;