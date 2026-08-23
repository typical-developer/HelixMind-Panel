type ResponseSchema = {
    status: "success" | "error",
    error?: string,
    payload?: any
}

export {
    ResponseSchema
}