import path from "node:path";
import { read_file } from "./file.service.js";
import { fileURLToPath } from "node:url";
import { throw_custom_error } from "../utils/error.js";
import { Resend } from "resend";
import { event_bus } from "./event.service.js";

const template_level_path = "../templates/mail/";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mails: Record<string, {
    html_path: string,
    subject?: string
}> = {
    "reset-password": {
        html_path: path.join(__dirname, template_level_path, "reset_password.html"),
        subject: "Reset Password"
    },
    "confirm-email": {
        html_path: path.join(__dirname, template_level_path, "../confirm_account.html")
    }
}

async function send_mail(type: keyof typeof mails, to: string[], vars?: Record<string, any>) {
    const mail_comp = mails[type];

    if (!mail_comp) {
        return throw_custom_error(`Mail type ${type} doesn't exist`)
    };

    var mail_file = await read_file(mail_comp.html_path);

    if (!mail_file) {
        return throw_custom_error("Could not find mail template")
    };

    if (vars) {
        Object.entries(vars).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            mail_file = (mail_file as string).replace(placeholder, value);
        });
    }

    const resend = new Resend(process.env.RESEND_API_KEY!);

    const { data, error } = await resend.emails.send({
        from: 'Helix <helix@traction3.com>',
        to,
        subject: mail_comp.subject ?? "Helix Mind",
        html: mail_file,
    });

    if (error) {
        throw_custom_error("Unable to send mail");
    }

    console.log({ data });
    return true;
}

export {
    send_mail
}