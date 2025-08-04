import mongoose from 'mongoose';

const swotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    technology: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent model overwrite issues in development
const swotModel = mongoose.models.swot || mongoose.model('swot', swotSchema);

export default swotModel;
