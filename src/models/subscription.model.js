import mongoose, {Schema} from "mongoose"


// subscription model schema
const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // one who is subscribing (i.e subscriber)
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // one to whom 'subscriber' is subscribing (i.e channel)
        ref: "User"
    }
}, {timestamps: true})


export const Subscription = mongoose.model("Subscription", subscriptionSchema)