import { request } from "./main";

export async function parse_fasta(fasta_file: File) {
    const formData = new FormData();

    formData.append("fasta-file", fasta_file);

    const response = await request<{
        response: any
    }>("/simulation/parse-fasta", {
        headers: {
            // "Content-Type": "multipart/form-data"
        },
        body: formData,
        method: "POST"
    });


    return response;
};

export async function previouslyReadFastas() {
    const response = await request<{
        response: any
    }>("/simulation/fastas", {
        headers: {
            "Content-Type": "application/json"
        },
    });


    return response;
}
