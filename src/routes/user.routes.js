import { Router } from "express";
import { registerUser, 
         loginUser,
         logoutUser,
         refreshAccessToken,
         changeCurrentPassword,
         getCurrentUser,
         updateAccountDetails,
         updateUserAvatar,
         updateUserCoverImage,
         getUserChannelProfile,
         getWatchHistory} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

// register route
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",     // avatar field name in the form
            maxCount: 1
        }, 
        {
            name: "coverImage", // coverImage field name in the form
            maxCount: 1
        }
    ]),
    registerUser
)

// login route
router.route("/login").post(loginUser)

// Secured routes
router.route("/logout").post(verifyJWT,  logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)                 // single file upload for avatar using multer middleware
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)    // similarly for cover image

router.route("/c/:username").get(verifyJWT, getUserChannelProfile)       // use "/:username" as it is mentioned in the 'getUserChannelProfile' function in the controller
router.route("/history").get(verifyJWT, getWatchHistory)


export default router