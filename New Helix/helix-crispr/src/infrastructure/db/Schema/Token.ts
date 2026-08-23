import { DataTypes } from "sequelize";
import { sequelize } from "../index.js";
import bcrypt from "bcryptjs";
import { User } from "./User.js";

const Token = sequelize.define(
  "Token",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
      comment: "Primary Key",
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    reference_id: {
        type: DataTypes.UUID,
        references: {
            model: "users",
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
    },
    purpose: {
      type: DataTypes.ENUM("confirm_email", "reset_password", "default"),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 10 * 60 * 1000),
      allowNull: false,
    },
    single_use: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    }
  },
  {
    timestamps: true,
    tableName: "tokens",
    underscored: true,
    hooks: {
      beforeCreate: (entry: any) => {
        // Hash password logic can be added here
        // Only hash if the token exists
        if (entry.token) {
           entry.token = bcrypt.hashSync(entry.token, 10);
        }
      }
    },
  }
);

User.hasMany(Token, { foreignKey: 'reference_id' });
Token.belongsTo(User, { foreignKey: 'reference_id' });

await Token.sync({ });

export {
    Token
}