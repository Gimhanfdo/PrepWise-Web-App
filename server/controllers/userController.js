import userModel from "../models/userModel.js";

// Controller to fetch details of the currently logged in user
export const getUserDetails = async (req, res) => {
  try {
    // Extract the user ID from the request object
    const userId = req.user.id;
    // Find the user in the database by their ID
    const user = await userModel.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // If user is found, return details
    res.json({
        success: true, 
        userData: {
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            accountType: user.accountType,
            isAccountVerified: user.isAccountVerified
        }
    })
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
