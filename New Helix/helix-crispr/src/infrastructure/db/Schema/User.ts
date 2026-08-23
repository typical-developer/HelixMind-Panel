import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "../index.js";
import bcrypt from "bcryptjs";
import { passwordSalt } from "../../../constants/salts.js";
import { Token } from "./Token.js";

const User = sequelize.define(
    "User",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: "Primary Key",
        },  
        fname: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lname: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isValidPassword(value: string) {
                    if (!/[A-Z]/.test(value)) {
                        throw new Error("Password must contain at least one uppercase letter.");
                    }

                    if (!/[a-z]/.test(value)) {
                        throw new Error("Password must contain at least one lowercase letter.");
                    }

                    if (!/[0-9]/.test(value)) {
                        throw new Error("Password must contain at least one digit.");
                    }

                    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
                        throw new Error("Password must contain at least one special character.");
                    }

                    if (value.length < 8) {
                        throw new Error("Password must be at least 8 characters long.");
                    }
                }
            }
        }
    },
    {
        timestamps: true,
        tableName: "users",
        underscored: true,
        hooks: {
            beforeCreate: (user) => {
                user.fname = user.fname.trim();
                user.lname = user.lname.trim();
                user.email = user.email.toLowerCase().trim();

                // Hash password logic can be added here
                user.password = bcrypt.hashSync(user.password, 10);
            },
            beforeUpdate: (user) => {
                // Normalize fields if they changed
                if (user.changed('fname')) user.fname = user.fname.trim();
                if (user.changed('lname')) user.lname = user.lname.trim();
                if (user.changed('email')) user.email = user.email.toLowerCase().trim();

                // ONLY hash the password if it has been modified
                if (user.changed('password')) {
                    user.password = bcrypt.hashSync(user.password, 10);
                }
            },
            afterCreate: (user: any) => {
                console.log(`New user created: ${user.email}`);
            }
        }
    }
)

await User.sync({ });

export {
    User
}