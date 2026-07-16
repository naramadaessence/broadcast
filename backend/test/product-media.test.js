import assert from 'node:assert/strict';
import test from 'node:test';
import { selectExplicitProductMedia } from '../src/utils/productMediaSelection.js';
import { sendMediaMessage } from '../src/services/whatsapp.js';

const products = [
    {
        id: 'white-mini',
        name: 'White Premium Mini Diffuser',
        sku: '27114003524856101',
        image_url: 'https://images.example.com/white-mini.jpg',
    },
    {
        id: 'premium-mini',
        name: 'Premium Mini Diffuser',
        sku: '27114003524856102',
        image_url: 'https://images.example.com/premium-mini.jpg',
    },
    {
        id: 'black-mini',
        name: 'Black Premium Mini Diffuser',
        sku: '27114003524856103',
        images: ['https://images.example.com/black-mini.png'],
    },
    {
        id: 'generic-diffuser',
        name: 'Diffuser',
        sku: 'GEN-DIFFUSER',
        image_url: 'https://images.example.com/generic.jpg',
    },
];

test('selects stored media for one exact SKU', () => {
    assert.deepEqual(
        selectExplicitProductMedia('Tell me about SKU 27114003524856101.', products),
        {
            id: 'white-mini',
            name: 'White Premium Mini Diffuser',
            sku: '27114003524856101',
            image_url: 'https://images.example.com/white-mini.jpg',
        }
    );
});

test('selects the longest complete unique product name without changing reply text', () => {
    assert.equal(
        selectExplicitProductMedia('Please show WHITE   PREMIUM MINI-DIFFUSER details', products)?.id,
        'white-mini'
    );
});

test('does not attach media to a broad product-family request', () => {
    assert.equal(selectExplicitProductMedia('show me diffuser', products), null);
});

test('does not attach one arbitrary image when multiple products are requested', () => {
    assert.equal(
        selectExplicitProductMedia(
            'Compare White Premium Mini Diffuser and Black Premium Mini Diffuser',
            products
        ),
        null
    );
    assert.equal(
        selectExplicitProductMedia(
            'Compare White Premium Mini Diffuser with Premium Mini Diffuser',
            products
        ),
        null
    );
});

test('does not attach media when an exact SKU is duplicated', () => {
    const duplicateSkuProducts = [
        products[0],
        { ...products[2], sku: products[0].sku, image_url: '', images: [] },
    ];
    assert.equal(
        selectExplicitProductMedia(`Product ${products[0].sku}`, duplicateSkuProducts),
        null
    );
});

test('does not treat duplicate product names as unique when one duplicate lacks media', () => {
    assert.equal(
        selectExplicitProductMedia('White Premium Mini Diffuser', [
            products[0],
            { ...products[0], id: 'white-mini-without-image', image_url: '' },
        ]),
        null
    );
});

test('uses the first valid stored image and ignores invalid image values', () => {
    assert.equal(
        selectExplicitProductMedia('Black Premium Mini Diffuser', products)?.image_url,
        'https://images.example.com/black-mini.png'
    );
    assert.equal(
        selectExplicitProductMedia('Invalid Image Product', [{
            id: 'invalid-image',
            name: 'Invalid Image Product',
            sku: 'INVALID-1',
            image_url: 'javascript:alert(1)',
        }]),
        null
    );
});

test('WhatsApp image delivery sends a URL as a link instead of an undefined media id', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl;
    let capturedPayload;

    globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedPayload = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({ messages: [{ id: 'wamid.test-image' }] }),
        };
    };

    try {
        const result = await sendMediaMessage(
            '9876543210',
            'image',
            'https://images.example.com/product.jpg?signature=exact%2Fvalue',
            'The unchanged DeepSeek reply',
            {
                whatsapp_access_token: 'test-token',
                whatsapp_phone_number_id: 'test-phone-id',
            }
        );

        assert.equal(capturedUrl, 'https://graph.facebook.com/v22.0/test-phone-id/messages');
        assert.deepEqual(capturedPayload.image, {
            link: 'https://images.example.com/product.jpg?signature=exact%2Fvalue',
            caption: 'The unchanged DeepSeek reply',
        });
        assert.equal(result.messageId, 'wamid.test-image');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
