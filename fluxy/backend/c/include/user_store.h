#ifndef FLUXY_USER_STORE_H
#define FLUXY_USER_STORE_H

#define USER_STORE_MAX_USERS 2000

typedef struct {
    int id;
    char name[128];
    char email[160];
    char phone[40];
    char cpf[40];
    char salt[33];
    char hash[65];
    char question[200];
    char asalt[33];
    char ahash[65];
    char created[32];
} User;

void user_store_load(void);

void user_store_save(void);

int user_store_count(void);
int user_store_next_id(void);

User *user_store_find_by_email(const char *email);
User *user_store_find_by_id(int id);

User *user_store_add(const User *user);

#endif
