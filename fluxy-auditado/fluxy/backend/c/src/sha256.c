#include "sha256.h"
#include "platform.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const unsigned int K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

#define ROR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

static void sha256_block(sha256_ctx *ctx, const unsigned char *p) {
    unsigned int w[64];
    unsigned int a, b, c, d, e, f, g, h, t1, t2;
    int i;

    for (i = 0; i < 16; i++) {
        w[i] = (p[i * 4] << 24) | (p[i * 4 + 1] << 16) | (p[i * 4 + 2] << 8) | p[i * 4 + 3];
    }
    for (i = 16; i < 64; i++) {
        unsigned int s0 = ROR(w[i - 15], 7) ^ ROR(w[i - 15], 18) ^ (w[i - 15] >> 3);
        unsigned int s1 = ROR(w[i - 2], 17) ^ ROR(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }

    a = ctx->state[0]; b = ctx->state[1]; c = ctx->state[2]; d = ctx->state[3];
    e = ctx->state[4]; f = ctx->state[5]; g = ctx->state[6]; h = ctx->state[7];

    for (i = 0; i < 64; i++) {
        unsigned int s1 = ROR(e, 6) ^ ROR(e, 11) ^ ROR(e, 25);
        unsigned int ch = (e & f) ^ ((~e) & g);
        t1 = h + s1 + ch + K[i] + w[i];
        unsigned int s0 = ROR(a, 2) ^ ROR(a, 13) ^ ROR(a, 22);
        unsigned int maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = s0 + maj;
        h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }

    ctx->state[0] += a; ctx->state[1] += b; ctx->state[2] += c; ctx->state[3] += d;
    ctx->state[4] += e; ctx->state[5] += f; ctx->state[6] += g; ctx->state[7] += h;
}

void sha256_init(sha256_ctx *ctx) {
    ctx->state[0] = 0x6a09e667; ctx->state[1] = 0xbb67ae85;
    ctx->state[2] = 0x3c6ef372; ctx->state[3] = 0xa54ff53a;
    ctx->state[4] = 0x510e527f; ctx->state[5] = 0x9b05688c;
    ctx->state[6] = 0x1f83d9ab; ctx->state[7] = 0x5be0cd19;
    ctx->bits = 0;
    ctx->len = 0;
}

void sha256_update(sha256_ctx *ctx, const unsigned char *data, size_t n) {
    for (size_t i = 0; i < n; i++) {
        ctx->buf[ctx->len++] = data[i];
        if (ctx->len == 64) {
            sha256_block(ctx, ctx->buf);
            ctx->bits += 512;
            ctx->len = 0;
        }
    }
}

void sha256_final(sha256_ctx *ctx, unsigned char out[32]) {
    unsigned long long bits = ctx->bits + (unsigned long long)ctx->len * 8;
    size_t i = ctx->len;

    ctx->buf[i++] = 0x80;
    if (i > 56) {
        while (i < 64) ctx->buf[i++] = 0;
        sha256_block(ctx, ctx->buf);
        i = 0;
    }
    while (i < 56) ctx->buf[i++] = 0;
    for (int j = 7; j >= 0; j--) ctx->buf[i++] = (unsigned char)(bits >> (j * 8));
    sha256_block(ctx, ctx->buf);

    for (i = 0; i < 8; i++) {
        out[i * 4]     = (unsigned char)(ctx->state[i] >> 24);
        out[i * 4 + 1] = (unsigned char)(ctx->state[i] >> 16);
        out[i * 4 + 2] = (unsigned char)(ctx->state[i] >> 8);
        out[i * 4 + 3] = (unsigned char)(ctx->state[i]);
    }
}

void to_hex(const unsigned char *in, size_t n, char *out) {
    static const char *digits = "0123456789abcdef";
    for (size_t i = 0; i < n; i++) {
        out[i * 2] = digits[in[i] >> 4];
        out[i * 2 + 1] = digits[in[i] & 15];
    }
    out[n * 2] = 0;
}

void slow_hash(const char *salt, const char *secret, char out_hex[65]) {
    unsigned char digest[32];
    sha256_ctx ctx;

    sha256_init(&ctx);
    sha256_update(&ctx, (const unsigned char *)salt, strlen(salt));
    sha256_update(&ctx, (const unsigned char *)":", 1);
    sha256_update(&ctx, (const unsigned char *)secret, strlen(secret));
    sha256_final(&ctx, digest);

    for (int i = 0; i < SHA256_HASH_ROUNDS; i++) {
        sha256_init(&ctx);
        sha256_update(&ctx, digest, 32);
        sha256_update(&ctx, (const unsigned char *)salt, strlen(salt));
        sha256_final(&ctx, digest);
    }

    to_hex(digest, 32, out_hex);
}

void random_hex(char *out, int bytes) {
    unsigned char raw[64];
    int got = 0;

#ifdef _WIN32
    HCRYPTPROV provider;
    if (CryptAcquireContext(&provider, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) {
        if (CryptGenRandom(provider, bytes, raw)) got = 1;
        CryptReleaseContext(provider, 0);
    }
#else
    FILE *urandom = fopen("/dev/urandom", "rb");
    if (urandom) {
        if (fread(raw, 1, bytes, urandom) == (size_t)bytes) got = 1;
        fclose(urandom);
    }
#endif

    if (!got) {
        for (int i = 0; i < bytes; i++) raw[i] = (unsigned char)(rand() ^ (clock() >> i));
    }

    to_hex(raw, bytes, out);
}
