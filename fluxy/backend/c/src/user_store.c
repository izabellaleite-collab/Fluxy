#include "user_store.h"
#include "app_paths.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static User users[USER_STORE_MAX_USERS];
static int user_count = 0;
static int next_id = 1;

static void trim_newline(char *s) {
    size_t n = strlen(s);
    while (n && (s[n - 1] == '\n' || s[n - 1] == '\r')) s[--n] = 0;
}

static void copy_field(char *dst, size_t size, const char *src) {
    size_t i = 0;
    for (; src[i] && i < size - 1; i++) {
        dst[i] = (src[i] == '\t' || src[i] == '\n' || src[i] == '\r') ? ' ' : src[i];
    }
    dst[i] = 0;
}

static int split_tab_fields(char *line, char *fields[], int max_fields) {
    int count = 0;
    fields[count++] = line;
    for (char *c = line; *c && count < max_fields; c++) {
        if (*c == '\t') {
            *c = 0;
            fields[count++] = c + 1;
        }
    }
    for (int j = 0; j < count; j++) {
        if (!strcmp(fields[j], "-")) fields[j] = (char *)"";
    }
    return count;
}

static User parse_user_line(char *line) {
    User user;
    memset(&user, 0, sizeof user);

    char *fields[16];
    int fieldCount = split_tab_fields(line, fields, 16);
    if (fieldCount < 7) return user;

    user.id = atoi(fields[0]);
    copy_field(user.name, sizeof user.name, fields[1]);
    copy_field(user.email, sizeof user.email, fields[2]);
    copy_field(user.phone, sizeof user.phone, fields[3]);
    copy_field(user.cpf, sizeof user.cpf, fields[4]);
    copy_field(user.salt, sizeof user.salt, fields[5]);
    copy_field(user.hash, sizeof user.hash, fields[6]);
    if (fieldCount > 7) copy_field(user.question, sizeof user.question, fields[7]);
    if (fieldCount > 8) copy_field(user.asalt, sizeof user.asalt, fields[8]);
    if (fieldCount > 9) copy_field(user.ahash, sizeof user.ahash, fields[9]);
    if (fieldCount > 10) copy_field(user.created, sizeof user.created, fields[10]);

    return user;
}

void user_store_load(void) {
    FILE *file = fopen(app_db_path(), "r");
    if (!file) return;

    char line[2048];
    while (fgets(line, sizeof line, file) && user_count < USER_STORE_MAX_USERS) {
        trim_newline(line);
        if (!line[0]) continue;

        User user = parse_user_line(line);
        if (user.id > 0 && user.email[0]) {
            users[user_count++] = user;
            if (user.id >= next_id) next_id = user.id + 1;
        }
    }
    fclose(file);
}

void user_store_save(void) {
    char tmpPath[540];
    snprintf(tmpPath, sizeof tmpPath, "%s.tmp", app_db_path());

    FILE *file = fopen(tmpPath, "w");
    if (!file) {
        fprintf(stderr, "[Fluxy-C] nao foi possivel gravar %s\n", app_db_path());
        return;
    }

    for (int i = 0; i < user_count; i++) {
        User *u = &users[i];
#define FLD(x) ((x)[0] ? (x) : "-")
        fprintf(file, "%d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
                u->id, FLD(u->name), FLD(u->email), FLD(u->phone), FLD(u->cpf),
                FLD(u->salt), FLD(u->hash), FLD(u->question), FLD(u->asalt),
                FLD(u->ahash), FLD(u->created));
#undef FLD
    }
    fclose(file);

    remove(app_db_path());
    rename(tmpPath, app_db_path());
}

int user_store_count(void) { return user_count; }
int user_store_next_id(void) { return next_id; }

User *user_store_find_by_email(const char *email) {
    for (int i = 0; i < user_count; i++) {
        if (strcmp(users[i].email, email) == 0) return &users[i];
    }
    return NULL;
}

User *user_store_find_by_id(int id) {
    for (int i = 0; i < user_count; i++) {
        if (users[i].id == id) return &users[i];
    }
    return NULL;
}

User *user_store_add(const User *user) {
    if (user_count >= USER_STORE_MAX_USERS) return NULL;

    users[user_count] = *user;
    User *stored = &users[user_count];
    user_count++;
    if (stored->id >= next_id) next_id = stored->id + 1;
    return stored;
}
