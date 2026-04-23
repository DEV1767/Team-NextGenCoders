import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    collegeName: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    graduationYear: {
        type: Number,
        required: true
    },
    role: {
        type: String,
        default: ""
    },
    experience: {
        type: String,
        default: ""
    },
    refreshToken: {
        type: String,
        select: false
    },
    resume: {
        url: String,
        publicId: String,
        fileName: String,
        extractedText: String,
        uploadedAt: Date
    }
}, { timestamps: true }
)

UserSchema.pre('save', async function () {
    if (!this.isModified("password"))
        return;

    this.password = await bcrypt.hash(this.password, 10)
})

UserSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}


UserSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id,
        email: this.email,
    },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
};

UserSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id,
        email: this.email
    }, process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY });
}

export default mongoose.model("Users", UserSchema)