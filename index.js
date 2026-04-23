import dotenv from "dotenv";
dotenv.config();

import { connectRedis } from "./src/config/redis.js"
import { connect_db } from "./src/model/db.connect.js";
import app from "./app.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        await connect_db();
       
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer(); 
