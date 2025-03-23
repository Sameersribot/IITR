const mongoose = require('mongoose');

const checkpointSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Checkpoint name is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Checkpoint type is required'],
        enum: ['start', 'milestone', 'verification', 'approval', 'completion']
    },
    giturl: {
        type: String,
        required: [true, 'Checkpoint type is required'],
    },
    dependencies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Checkpoint'
    }],
    commitDependencies: [{
        type: String,
        validate: {
            validator: function(v) {
                return /https:\/\/github.com\/.*\/commit\/[a-f0-9]{40}/.test(v);
            },
            message: props => `${props.value} is not a valid GitHub commit URL!`
        }
    }],
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'in-progress', 'completed']
    },
    summary: {
        type:String,
    }
}, { timestamps: true });

module.exports = mongoose.model('Checkpoint', checkpointSchema);