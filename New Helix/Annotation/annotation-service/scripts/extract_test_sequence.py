"""
HelixMind — Test Sequence Extractor

Pulls the blaTEM-1B reference sequence directly out of your locally
cloned resfinder_db. This guarantees a 100% identity match if your
pipeline is wired correctly — no risk of a hand-typed sequence being wrong.

Usage:
    python3 extract_test_sequence.py
    (writes test_sequence.txt and prints the sequence + header found)
"""

import glob
import os
import sys

DB_DIR = os.getenv("RESFINDER_DB_PATH", "./databases/resfinder_db")
TARGET_GENE = "blaTEM-1B"


def find_gene_sequence(db_dir: str, gene_name: str):
    fasta_files = glob.glob(os.path.join(db_dir, "*.fsa"))
    if not fasta_files:
        print(f" No .fsa files found in {db_dir}")
        print("   Check that resfinder_db was cloned correctly.")
        sys.exit(1)

    for fasta_path in fasta_files:
        header = None
        seq_lines = []
        capturing = False

        with open(fasta_path) as f:
            for line in f:
                line = line.rstrip("\n")
                if line.startswith(">"):
                    if capturing:
                        break  # stop once we've captured the target record
                    # Header format: >geneName_alleleNum_accession
                    # e.g. >blaTEM-1B_1_AY458016
                    name_part = line[1:].split("_")[0]
                    if name_part == gene_name:
                        header = line[1:]
                        capturing = True
                else:
                    if capturing:
                        seq_lines.append(line.strip())

        if header:
            return header, "".join(seq_lines), fasta_path

    return None, None, None


if __name__ == "__main__":
    header, sequence, source_file = find_gene_sequence(DB_DIR, TARGET_GENE)

    if not sequence:
        print(f" Could not find {TARGET_GENE} in {DB_DIR}")
        print("   Try a different gene name, or check the DB was indexed correctly.")
        sys.exit(1)

    print(f" Found: {header}")
    print(f"   Source: {source_file}")
    print(f"   Length: {len(sequence)} bp")
    print()
    print(sequence)

    with open("test_sequence.txt", "w") as out:
        out.write(sequence)

    print()
    print("✓ Written to test_sequence.txt")