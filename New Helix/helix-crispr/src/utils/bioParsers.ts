export const parseFASTA = (content: string) => {
    const records: Record<string, string> = {};
    const parts = content.split('>');
    
    for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        const header = lines[0].split(/\s+/)[0];
        const sequence = lines.slice(1).join('').toUpperCase().replace(/[^ATGCN]/g, '');
        records[header] = sequence;
    }
    return records;
};

export const parseGFF = (content: string) => {
    return content.split('\n')
        .filter(line => !line.startsWith('#') && line.trim())
        .map(line => {
            const fields = line.split('\t');
            if (fields.length < 9) return null;
            const [seqname, , type, start, end, , strand, , attributes] = fields;
            
            // Extract Name from attributes
            const nameMatch = attributes.match(/(?:Name|gene_name|locus_tag)=([^;]+)/);
            const name = nameMatch ? decodeURIComponent(nameMatch[1]) : `${type}_${start}`;

            return {
                seqname, type, name,
                start: parseInt(start),
                end: parseInt(end),
                strand: strand === '+' ? 1 : -1
            };
        }).filter(Boolean);
};