import { Router } from "express";
import { registerUser, 
         loginUser,
         logoutUser} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

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

export default router