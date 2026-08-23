export const createRNG = (initialSeed: number) => {
    let seed = initialSeed;

    return (): number => {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
        return ((t ^ (t >>> 32)) >>> 0) / 4294967296;
    };
};