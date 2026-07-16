function normalizeIdentifier(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function containsCompleteIdentifier(normalizedMessage, value) {
    const normalizedValue = normalizeIdentifier(value);
    if (!normalizedMessage || !normalizedValue) return false;
    return ` ${normalizedMessage} `.includes(` ${normalizedValue} `);
}

function validProductImageUrl(product = {}) {
    const candidates = [
        product.image_url,
        ...(Array.isArray(product.images) ? product.images : []),
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            const url = new URL(String(candidate));
            if (url.protocol === 'https:' || url.protocol === 'http:') {
                return String(candidate).trim();
            }
        } catch {
            // Ignore invalid stored media and preserve the normal text reply.
        }
    }

    return null;
}

function toMediaProduct(product, imageUrl) {
    const rawId = product.id || product._id;
    return {
        id: rawId ? String(rawId) : null,
        name: String(product.name || '').trim(),
        sku: String(product.sku || '').trim(),
        image_url: imageUrl,
    };
}

function mediaForProduct(product) {
    const imageUrl = validProductImageUrl(product);
    return imageUrl ? toMediaProduct(product, imageUrl) : null;
}

export function selectExplicitProductMedia(messageBody, products = []) {
    const normalizedMessage = normalizeIdentifier(messageBody);
    if (!normalizedMessage || !Array.isArray(products) || products.length === 0) {
        return null;
    }

    const candidates = products.map((product) => ({
        product,
        normalizedName: normalizeIdentifier(product.name),
    }));

    const skuMatches = candidates.filter(({ product }) => (
        product.sku && containsCompleteIdentifier(normalizedMessage, product.sku)
    ));
    if (skuMatches.length === 1) {
        return mediaForProduct(skuMatches[0].product);
    }
    if (skuMatches.length > 1) return null;

    const nameMatches = candidates.filter(({ normalizedName }) => (
        normalizedName.split(' ').filter(Boolean).length >= 2
        && containsCompleteIdentifier(normalizedMessage, normalizedName)
    ));
    if (nameMatches.length === 1) {
        return mediaForProduct(nameMatches[0].product);
    }
    if (nameMatches.length === 0) return null;

    const longestLength = Math.max(...nameMatches.map(({ normalizedName }) => normalizedName.length));
    const longestMatches = nameMatches.filter(({ normalizedName }) => normalizedName.length === longestLength);
    if (longestMatches.length !== 1) return null;

    const longest = longestMatches[0];
    const remainingMessage = normalizedMessage.replace(longest.normalizedName, ' ');
    const mentionsAnotherProduct = nameMatches.some(({ normalizedName }) => (
        normalizedName !== longest.normalizedName
        && containsCompleteIdentifier(remainingMessage, normalizedName)
    ));
    if (mentionsAnotherProduct) return null;

    return mediaForProduct(longest.product);
}
