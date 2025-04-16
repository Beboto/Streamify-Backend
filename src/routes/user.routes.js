import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",  // avatar field name in the form
            maxCount: 1
        }, 
        {
            name: "coverImage", // coverImage field name in the form
            maxCount: 1
        }
    ]),
    registerUser
)

export default router