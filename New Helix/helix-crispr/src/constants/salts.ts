const passwordSalt = process.env.PASSWORD_HASH_SALT || "no_salt_provided";

export { passwordSalt };