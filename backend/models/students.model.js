const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
  first_name: {
    type : String,
    required: true
  },
  last_name: {
    type : String,
    required: true
  },
  email: {
    type : String,
    required: true,
    unique: true
  },
  phone: {
    type : String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Phone number must be numeric and 10 digits'
    }
  },
  gender: {
    type : String,
    enum: ['Male','Female','Other'],
    required: true
  },
  profile_pic: {
    type : String
  }
})

const Student = mongoose.model('Student', studentSchema)

module.exports = Student
