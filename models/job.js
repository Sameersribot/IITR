const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'Web Development',
        'Mobile Development',
        'UI/UX Design',
        'Graphic Design',
        'Content Writing',
        'Digital Marketing',
        'Video Editing'
      ],
      message: 'Invalid job category'
    }
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required'],
    
  },
  experienceLevel: {
    type: String,
    required: [true, 'Experience level is required'],
    enum: {
      values: ['Entry Level', 'Intermediate', 'Expert'],
      message: 'Invalid experience level'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // References your User model
    required: true

  },
  checkpoints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Checkpoint'
  }]
});

module.exports = mongoose.model('Job', jobSchema);