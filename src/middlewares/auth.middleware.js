import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

// export the verifyJWT middleware function
export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        // console.log(token);

        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        // verify the token 
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        // find the user from db using the id from the token, and remove password and refresh token from the user object
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            throw new ApiError(401, "Invalid Access Token")
        }
    
        // set the user in request object for further use and call next middleware
        req.user = user;

        // since the token is valid, we can call next middleware
        next()
    } 
    catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
    
})