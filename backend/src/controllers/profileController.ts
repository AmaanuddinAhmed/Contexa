import { Response } from "express";
import { Profile } from "../models/Profile.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { profileSchema } from "../utils/validation.js";

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const profile = await Profile.findOne({
      userId: req.userId
    });

    res.json({
      success: true,
      data: {
        profile
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      success: false,
      error: {
        code: "PROFILE_FETCH_FAILED",
        message: "Unable to retrieve profile."
      }
    });
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = profileSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PROFILE",
          message: "Invalid profile data."
        }
      });
      return;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.userId },
      {
        ...result.data,
        userId: req.userId
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      data: {
        profile
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      success: false,
      error: {
        code: "PROFILE_UPDATE_FAILED",
        message: "Unable to update profile."
      }
    });
  }
};