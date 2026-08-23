import dotenv from "dotenv";
dotenv.config();

import colors from "colors";
import { Sequelize } from "sequelize";

import { User } from "./Schema/User.js";
import { Token } from "./Schema/Token.js";
import { FastaFiles } from "./Schema/FastaFiles.js";

const sequelize = new Sequelize(process.env.DATABASE_CONNECTION_URL!, {
    dialect: "mysql",
    dialectOptions: {
        ssl: {
            rejectUnauthorized: true
        }
    }
});

try {
    await sequelize.authenticate();
    console.log(colors.green("Database connection established successfully."));

    await sequelize.sync();
    console.log(colors.green('All models were synchronized successfully.'));
} catch (error) {
    console.error(colors.red(`Unable to connect to the database: ${JSON.stringify(error)}`));
}

export { sequelize };