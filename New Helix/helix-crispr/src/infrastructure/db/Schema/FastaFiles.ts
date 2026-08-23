import { DataTypes } from "sequelize";
import { sequelize } from "../index.js";
import { User } from "./User.js";

const FastaFiles = sequelize.define(
    "FastaFiles",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: "Primary Key",
        },
        file: {
            type: DataTypes.STRING,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            references: {
                model: "users",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
        }
    },
    {
        timestamps: true,
        tableName: "fasta_files",
        underscored: true,
    }
)

User.hasMany(FastaFiles, { foreignKey: 'user_id' });
FastaFiles.belongsTo(User, { foreignKey: 'user_id' });

FastaFiles.sync();

export {FastaFiles}