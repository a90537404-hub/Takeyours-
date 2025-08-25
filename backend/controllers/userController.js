
const jwt = require("jsonwebtoken");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const db = require("../db");

// 🌥️ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Ensure extra public_id columns are present
const ensureUsersTable = async () => {
  try {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS id_front_public_id TEXT,
      ADD COLUMN IF NOT EXISTS id_back_public_id TEXT,
      ADD COLUMN IF NOT EXISTS liveness_public_id TEXT,
      ADD COLUMN IF NOT EXISTS profile_photo_public_id TEXT,
      ADD COLUMN IF NOT EXISTS profile_video_public_id TEXT;
    `);
    console.log("✅ public_id columns ensured");
  } catch (err) {
    console.error("🔥 Failed to ensure users table:", err.message);
  }
};
ensureUsersTable();

// ✅ Upload Helper
const uploadToCloudinary = async (filePath, resourceType = "auto") => {
  try {
    const result = await cloudinary.uploader.unsigned_upload(filePath, "takeyours", {
      resource_type: resourceType,
    });
    fs.unlinkSync(filePath);
    return result;
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw new Error("Upload failed");
  }
};

// ✅ Delete Helper
const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.warn(`⚠️ Cloudinary delete failed for ${publicId}:`, err.message);
  }
};

// ✅ Save Personal Info
exports.savePersonalInfo = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const photo = req.files?.photo?.[0] || null;
    const video = req.files?.video?.[0] || null;
    let photoUrl = null, videoUrl = null;
    let photoId = null, videoId = null;

    if (photo) {
      const result = await uploadToCloudinary(photo.path, "image");
      photoUrl = result.secure_url;
      photoId = result.public_id;
    }
    if (video) {
      const result = await uploadToCloudinary(video.path, "video");
      videoUrl = result.secure_url;
      videoId = result.public_id;
    }

    const {
      full_name = null, dob = null, gender = null, orientation = null,
      country_of_birth = null, country_of_residence = null, county_of_residence = null,
      willing_to_relocate = null, preferred_language = null, education = null, occupation = null,
      employment_type = null, religion = null, religious_importance = null, political_views = null,
      height = null, weight = null, skin_color = null, body_type = null, eye_color = null,
      hair_color = null, ethnicity = null, diet = null, smoking = null, drinking = null,
      exercise = null, pets = null, living_situation = null, children = null
    } = req.body;

    const languagesRaw = req.body.languages || [];
    const languages = Array.isArray(languagesRaw)
      ? languagesRaw.filter(Boolean)
      : [languagesRaw].filter(Boolean);

    await db.query(`
      UPDATE users SET
        full_name = $1, dob = $2, gender = $3, orientation = $4,
        country_of_birth = $5, country_of_residence = $6, county_of_residence = $7,
        willing_to_relocate = $8, languages = $9, preferred_language = $10,
        education = $11, occupation = $12, employment_type = $13,
        religion = $14, religious_importance = $15, political_views = $16,
        height = $17, weight = $18, skin_color = $19, body_type = $20,
        eye_color = $21, hair_color = $22, ethnicity = $23,
        diet = $24, smoking = $25, drinking = $26, exercise = $27,
        pets = $28, living_situation = $29, children = $30,
        profile_photo_url = COALESCE($31, profile_photo_url),
        profile_video_url = COALESCE($32, profile_video_url),
        profile_photo_public_id = COALESCE($33, profile_photo_public_id),
        profile_video_public_id = COALESCE($34, profile_video_public_id),
        current_step = 'preferences'
      WHERE email = $35
    `, [
      full_name, dob, gender, orientation,
      country_of_birth, country_of_residence, county_of_residence,
      willing_to_relocate, languages, preferred_language,
      education, occupation, employment_type,
      religion, religious_importance, political_views,
      height, weight, skin_color, body_type,
      eye_color, hair_color, ethnicity,
      diet, smoking, drinking, exercise,
      pets, living_situation, children,
      photoUrl, videoUrl, photoId, videoId, email
    ]);

    return res.json({ success: true, message: "Personal info saved", userId: decoded.userId || null });
  } catch (err) {
    console.error("🔥 Personal Info Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error saving personal info." });
  }
};

// ✅ Save Match Preferences
exports.savePreferences = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const {
      pref_gender = null, pref_age_min = null, pref_age_max = null,
      pref_country_of_birth = null, pref_country_of_residence = null, pref_county_of_residence = null,
      pref_country = null, pref_languages = [],
      pref_religion = null, pref_religion_importance = null,
      pref_height = null, pref_weight = null, pref_body_type = null,
      pref_skin_color = null, pref_ethnicity = null, pref_diet = null,
      pref_smoking = null, pref_drinking = null, pref_exercise = null,
      pref_pets = null, pref_children = null, pref_living_situation = null,
      pref_willing_to_relocate = null, pref_relationship_type = null
    } = req.body;

    const prefLangs = Array.isArray(pref_languages)
      ? pref_languages.filter(Boolean)
      : [pref_languages].filter(Boolean);

    await db.query(`
      UPDATE users SET
        pref_gender = $1, pref_age_min = $2, pref_age_max = $3,
        pref_country_of_birth = $4, pref_country_of_residence = $5, pref_county_of_residence = $6,
        pref_country = $7, pref_languages = $8,
        pref_religion = $9, pref_religion_importance = $10,
        pref_height = $11, pref_weight = $12, pref_body_type = $13,
        pref_skin_color = $14, pref_ethnicity = $15, pref_diet = $16,
        pref_smoking = $17, pref_drinking = $18, pref_exercise = $19,
        pref_pets = $20, pref_children = $21, pref_living_situation = $22,
        pref_willing_to_relocate = $23, pref_relationship_type = $24,
        current_step = 'submission', is_complete = true
      WHERE email = $25
    `, [
      pref_gender, pref_age_min, pref_age_max,
      pref_country_of_birth, pref_country_of_residence, pref_county_of_residence,
      pref_country, prefLangs,
      pref_religion, pref_religion_importance,
      pref_height, pref_weight, pref_body_type,
      pref_skin_color, pref_ethnicity, pref_diet,
      pref_smoking, pref_drinking, pref_exercise,
      pref_pets, pref_children, pref_living_situation,
      pref_willing_to_relocate, pref_relationship_type,
      email
    ]);

    return res.status(200).json({ success: true, message: "Preferences updated successfully." });
  } catch (error) {
    console.error("🔥 Preferences Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error saving preferences." });
  }
};

// ✅ Get User Progress (includes admin_message)
exports.getUserProgress = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const result = await db.query(
      "SELECT current_step, status, admin_message FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      await db.query(
        "INSERT INTO users (email, current_step, status) VALUES ($1, 'identity', 'pending')",
        [email]
      );
      return res.status(200).json({
        current_step: "identity",
        status: "pending",
        adminMessage: null
      });
    }

    const { current_step, status, admin_message } = result.rows[0];
    return res.status(200).json({
      current_step: current_step || "identity",
      status: status || "pending",
      adminMessage: admin_message || null
    });

  } catch (err) {
    console.error("🔥 Progress Error:", err.message);
    return res.status(500).json({ message: "Server error fetching progress" });
  }
};

// ✅ Reset All
exports.resetUserSubmission = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const { rows } = await db.query(
      `SELECT id_front_public_id, id_back_public_id, liveness_public_id,
              profile_photo_public_id, profile_video_public_id
       FROM users WHERE email = $1`,
      [email]
    );

    const user = rows[0];
    await deleteCloudinaryAsset(user.id_front_public_id);
    await deleteCloudinaryAsset(user.id_back_public_id);
    await deleteCloudinaryAsset(user.liveness_public_id);
    await deleteCloudinaryAsset(user.profile_photo_public_id);
    await deleteCloudinaryAsset(user.profile_video_public_id);

    await db.query(`
      UPDATE users SET
        id_front_url=NULL, id_back_url=NULL, liveness_video_url=NULL,
        full_name=NULL, dob=NULL, gender=NULL, orientation=NULL,
        country_of_birth=NULL, country_of_residence=NULL, county_of_residence=NULL,
        willing_to_relocate=NULL, languages=NULL, preferred_language=NULL,
        education=NULL, occupation=NULL, employment_type=NULL,
        religion=NULL, religious_importance=NULL, political_views=NULL,
        height=NULL, weight=NULL, skin_color=NULL, body_type=NULL,
        eye_color=NULL, hair_color=NULL, ethnicity=NULL,
        diet=NULL, smoking=NULL, drinking=NULL, exercise=NULL,
        pets=NULL, living_situation=NULL, children=NULL,
        profile_photo_url=NULL, profile_video_url=NULL,
        pref_gender=NULL, pref_age_min=NULL, pref_age_max=NULL,
        pref_country_of_birth=NULL, pref_country_of_residence=NULL, pref_county_of_residence=NULL,
        pref_country=NULL, pref_languages=NULL, pref_religion=NULL,
        pref_religion_importance=NULL, pref_height=NULL, pref_weight=NULL,
        pref_body_type=NULL, pref_skin_color=NULL, pref_ethnicity=NULL,
        pref_diet=NULL, pref_smoking=NULL, pref_drinking=NULL, pref_exercise=NULL,
        pref_pets=NULL, pref_children=NULL, pref_living_situation=NULL,
        pref_willing_to_relocate=NULL, pref_relationship_type=NULL,
        is_complete=false, current_step='identity', status='pending',
        admin_message=NULL,
        id_front_public_id=NULL, id_back_public_id=NULL, liveness_public_id=NULL,
        profile_photo_public_id=NULL, profile_video_public_id=NULL
      WHERE email = $1
    `, [email]);

    return res.status(200).json({ success: true, message: "User data reset." });
  } catch (err) {
    console.error("🔥 Reset Submission Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error resetting submission." });
  }
};

// ✅ Reset Identity Only
exports.resetIdentityOnly = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const { rows } = await db.query(
      `SELECT id_front_public_id, id_back_public_id, liveness_public_id FROM users WHERE email = $1`,
      [email]
    );

    const user = rows[0];
    await deleteCloudinaryAsset(user.id_front_public_id);
    await deleteCloudinaryAsset(user.id_back_public_id);
    await deleteCloudinaryAsset(user.liveness_public_id);

    await db.query(`
      UPDATE users SET
        id_front_url=NULL, id_back_url=NULL, liveness_video_url=NULL,
        id_front_public_id=NULL, id_back_public_id=NULL, liveness_public_id=NULL,
        current_step='identity', status='pending', is_complete=false
      WHERE email=$1
    `, [email]);

    return res.json({ success: true, message: "Identity reset complete" });
  } catch (err) {
    console.error("🔥 Reset Identity Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error resetting identity" });
  }
};

// ✅ Reset Personal Only
exports.resetPersonalOnly = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const { rows } = await db.query(
      `SELECT profile_photo_public_id, profile_video_public_id FROM users WHERE email = $1`,
      [email]
    );

    const user = rows[0];
    await deleteCloudinaryAsset(user.profile_photo_public_id);
    await deleteCloudinaryAsset(user.profile_video_public_id);

    await db.query(`
      UPDATE users SET
        full_name=NULL, dob=NULL, gender=NULL, orientation=NULL,
        country_of_birth=NULL, country_of_residence=NULL, county_of_residence=NULL,
        willing_to_relocate=NULL, languages=NULL, preferred_language=NULL,
        education=NULL, occupation=NULL, employment_type=NULL,
        religion=NULL, religious_importance=NULL, political_views=NULL,
        height=NULL, weight=NULL, skin_color=NULL, body_type=NULL,
        eye_color=NULL, hair_color=NULL, ethnicity=NULL,
        diet=NULL, smoking=NULL, drinking=NULL, exercise=NULL,
        pets=NULL, living_situation=NULL, children=NULL,
        profile_photo_url=NULL, profile_video_url=NULL,
        profile_photo_public_id=NULL, profile_video_public_id=NULL,
        current_step='personal', status='pending', is_complete=false
      WHERE email=$1
    `, [email]);

    return res.json({ success: true, message: "Personal data reset complete" });
  } catch (err) {
    console.error("🔥 Reset Personal Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error resetting personal info" });
  }
};
