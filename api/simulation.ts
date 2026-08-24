import { request } from "./main";

export async function simulate_mutation(fasta_file: File, params: {
    tempUnit: "C" | "F",
    temperature: number,
    substitutionRate: number,
    numGenerations: number
}) {
    const formData = new FormData();

    formData.append("fasta-file", fasta_file);
    formData.append("params", JSON.stringify(params));

    const response = await request<{
        response: any
    }>("/simulation/simulate", {
        headers: {
            // "Content-Type": "multipart/form-data"
        },
        body: formData,
        method: "POST"
    });


    return response;
}