import { EventEmitter } from "events";
import { send_mail } from "./mail.service.js";
import { create_otp } from "./token.service.js";

const event_bus = new EventEmitter();

// Optional: Set max listeners to avoid memory leak warnings
event_bus.setMaxListeners(50);

// Mail Events
event_bus.on("send_reset_password_mail", async function (to: string[], user_id: string) {
    try {
        const token = await create_otp("reset_password", user_id);

        await send_mail("reset-password", to, {
            otp_code: token,
            support_mail: "helix@traction3.com"
        });
    } catch (error) {
        console.error("Server Error occured during reset password mail send action \n", error);
    }
})

export {
    event_bus
}