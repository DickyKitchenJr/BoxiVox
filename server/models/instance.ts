import { Schema, Types, model, type SchemaDefinition } from "mongoose";

export interface IInstance {
  setupCompleted: boolean;
  adminUserId?: Types.ObjectId;
  passwordsRequired: boolean;
  allowExternalAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const instanceSchema = new Schema<IInstance>(
  {
    _id: { type: String, default: "primary", immutable: true },
    setupCompleted: { type: Boolean, default: false },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User" },
    passwordsRequired: { type: Boolean, default: true },
    allowExternalAccess: { type: Boolean, default: false },
  } as SchemaDefinition<IInstance>,
  { timestamps: true },
);

instanceSchema.pre("validate", function (this: IInstance) {
  if (this.allowExternalAccess && !this.passwordsRequired) {
    throw new Error("External access requires passwords");
  }
});

export const Instance = model<IInstance>("Instance", instanceSchema);