import fs from "node:fs/promises";
import colors from "colors";

async function read_file(name: string) {
    try {
        const file = await fs.readFile(name, "utf-8");
        return file;
    } catch (error) {
        console.error('File error: \n', colors.red(error instanceof Error ? error.message : JSON.stringify(error)));
    }
}

export {
    read_file
}