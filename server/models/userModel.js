import mongoose, { Mongoose } from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    phoneNumber: {type: Number, required: true},
    accountType: {type: String, required: true},
    accountPlan: {type: String, enum: ['basic', 'premium'], default: 'basic'},
    verifyOtp: {type: String, default: ''},
    verifyOtpExpireAt: {type: Number, default: 0},
    isAccountVerified: {type: Boolean, default: false},
    resetOtp: {type: String, default: ''},
    resetOtpExpireAt: {type: Number, default: 0},
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;