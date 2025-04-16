import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok"
    // })

    /*
    Algorithm:
    1. get user details from frontend
    2. validation - not empty
    3. check if user already exists: username, email
    4. check for images, check for avatar
    5. upload them to cloudinary, avatar
    6. create user object - create entry in db
    7. remove password and refresh token field from response
    8. check for user creation
    9. return res
    */

    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    // to check if any of the fields are empty
    if ( 
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // to check if the username exists or not
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    // if exists, throw error
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    // to check if the avatar is present or not
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    // get the cover image path if it exists
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    // if avatar is not present, throw error
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // upload the avatar and cover image to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // if not uploaded, throw error
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   
    // create user object
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    // remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // is user not created, throw error
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return response using ApiResponse template
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )


})

export {registerUser}