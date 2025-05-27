import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

// Middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))                          // Limit the size of JSON payloads to 16kb
app.use(express.urlencoded({extended: true, limit: "16kb"}))    // Limit the size of URL-encoded payloads to 16kb
app.use(express.static("public"))                               // Serve static files from the "public" directory
app.use(cookieParser())                                         // Parse cookies from incoming requests

// Import routes
import userRoutes from "./routes/user.routes.js"

// Use routes
app.use("/api/v1/users", userRoutes)



export { app }