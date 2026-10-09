#ifndef FLUXY_PLATFORM_H
#define FLUXY_PLATFORM_H

#ifdef _WIN32
#  include <winsock2.h>
#  include <ws2tcpip.h>
#  include <windows.h>
#  include <wincrypt.h>
#  include <direct.h>
#  define CLOSESOCK closesocket
#  define MKDIR(path) _mkdir(path)
typedef int socklen_t;
#else
#  include <sys/socket.h>
#  include <sys/stat.h>
#  include <netinet/in.h>
#  include <arpa/inet.h>
#  include <unistd.h>
#  include <signal.h>
#  define CLOSESOCK close
#  define MKDIR(path) mkdir(path, 0755)
typedef int SOCKET;
#  define INVALID_SOCKET (-1)
#endif

#endif
