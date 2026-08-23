/**
 * Curated antimicrobial-resistance gene records.
 *
 * Shared by the Gene Database view and the workbench's database side-bar so the
 * two never drift apart.
 */
export interface AMRRecord {
  id: string
  gene: string
  antibiotic: string
  drugClass: string
  mechanism: string
  organism: string
  impact: number
}

export const AMR_RECORDS: AMRRecord[] = [
  {
    id: "AMR001",
    gene: "blaCTX-M",
    antibiotic: "Cephalosporins",
    drugClass: "Beta-lactams",
    mechanism: "Beta-lactamase",
    organism: "E. coli",
    impact: 12.5,
  },
  {
    id: "AMR002",
    gene: "gyrA",
    antibiotic: "Fluoroquinolones",
    drugClass: "Quinolones",
    mechanism: "DNA gyrase mutation",
    organism: "Salmonella",
    impact: 8.4,
  },
  {
    id: "AMR003",
    gene: "rpoB",
    antibiotic: "Rifamycins",
    drugClass: "RNA polymerase inhibitors",
    mechanism: "RNA polymerase mutation",
    organism: "M. tuberculosis",
    impact: 1.56,
  },
  {
    id: "AMR004",
    gene: "mecA",
    antibiotic: "Oxacillin",
    drugClass: "Beta-lactams",
    mechanism: "Penicillin-binding protein",
    organism: "S. aureus",
    impact: 9.23,
  },
  {
    id: "AMR005",
    gene: "erm(B)",
    antibiotic: "Macrolides",
    drugClass: "Protein synthesis inhibitors",
    mechanism: "rRNA methylation",
    organism: "S. pneumoniae",
    impact: 6.78,
  },
]

export const AMR_DATABASE_STATS = [
  { label: "Total Genes", value: "2,847" },
  { label: "Organisms", value: "456" },
  { label: "Drug Classes", value: "128" },
  { label: "Last Updated", value: "2024-01-12" },
]
