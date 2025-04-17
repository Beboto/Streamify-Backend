import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


// Method to generate access and refresh tokens during first login using user id
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        // get user from db using user id
        const user = await User.findById(userId)           
        const accessToken = user.generateAccessToken()     
        const refreshToken = user.generateRefreshToken()

        // set the refresh token in the user model and save in db
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
    } 
    catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}  


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
    // console.log(req.files);

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
}
)


const loginUser = asyncHandler(async (req, res) =>{
    /*
    Algorithm:
    1. req body -> data
    2. username or email
    3. find the user in db
    4. password check correct
    5. access and referesh token 
    6. send cookie
    */

    // get user details from frontend
    const {email, username, password} = req.body
    console.log(email);

    // if both username and email are not present, throw error (one must be present)
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    // find the user in db using username or email
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    // if user not found, throw error
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // check if the password is correct
   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

    // generate access and refresh tokens using user id
   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // find the user in db again to get the updated user object and remove password and refresh token from response
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // to set the cookie options 
    const options = {
        httpOnly: true,
        secure: true
    }

    // return cookie and response using ApiResponse template
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)            // set access token and refresh token in cookie and send json response
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})


const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,            // find the user using id from request object
        {
            $unset: {
                refreshToken: 1  // this removes the field from document
            }
        },
        {
            new: true            // to return the updated document
        }
    )

    // to set the cookie options
    const options = {
        httpOnly: true,
        secure: true
    }

    // clear the cookies and send response using ApiResponse template
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}