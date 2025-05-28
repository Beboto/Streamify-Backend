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
    // console.log(email);

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


// Method to refresh the access token using refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
    // get the refresh token from cookies or body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        // verify the refresh token using secret key
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        // get the user from db using id from refresh token
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        // throw error if the refresh token is not same as the one in db
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")  
        }
    
        // generate new access and refresh tokens using user id 
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)          // set access token and refresh token in cookie and send json response
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } 
    catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }

})


const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)  // get the user from db using id from request object
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)  // call the method from user model to check if correct password 

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    // set the new password in the user model and save in db
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})


const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})


const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            // mongodb operators to update the fields
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}        // to return the updated user object
        
    ).select("-password")  // remove password from response

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});


const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path   // get the avatar local path from request object

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}        // to return the updated avatar url
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})


const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cover image")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


// Method to get the user channel profile using username
const getUserChannelProfile = asyncHandler(async(req, res) => {
    // get the username from request params (i.e url api/user/:username) 
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    // use aggregate to get the user channel profile using username
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()   // match the username in db
            }
        },
        {
            $lookup: {                              // lookup the subscriptions collection to get the subscribers count
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {                              // lookup the subscriptions collection to get the channels subscribed-to count
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {                           // add fields to the user object
                subscribersCount: {
                    $size: "$subscribers"           // get the subscribers count
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"          // get the channels subscribed-to count
                },
                isSubscribed: {                     // check if the user is subscribed to the channel or not
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},  
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {                             // projets only the required fields to be sent in response
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})


// Method to get the watch history of the user
const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)  // create a new object id from the user id in request object and match it in db
            }
        },
        {
            $lookup: {                                          // lookup the videos collection to get the watch history of the user
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [                                    // create a sub-pipeline to get the video details and owner details
                    {
                        $lookup: {                             // lookup the user collection to get the owner details
                            from: "users",                    
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [                        // create a sub-pipeline to get the owner details
                                {
                                    $project: {                // projects only the required fields to be sent in response
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{                           // overwrite the owner field to get the first element of the owner array
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,                            // data is the watch history of the user
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}