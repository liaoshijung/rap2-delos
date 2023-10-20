# BUILDING
FROM node:16.20.2 AS builder

# base on work of llitfkitfk@gmail.com
LABEL maintainer="chibing.fy@alibaba-inc.com"

WORKDIR /app

# cache dependencies
COPY package.json ./

# 在国内打开下面一行加速
RUN npm config set registry https://registry.npm.taobao.org/

RUN npm install cnpm -g

# instal dependencies
RUN cnpm install typescript -g && \
    cnpm install

# build
COPY . ./
RUN npm run build

# RUNNING
FROM node:16.20.2

# base on work of llitfkitfk@gmail.com
LABEL maintainer="chibing.fy@alibaba-inc.com"
# use China mirror of: https://github.com/jgm/pandoc/releases/download/2.7.3/pandoc-2.7.3-linux.tar.gz
RUN wget http://rap2-taobao-org.oss-cn-beijing.aliyuncs.com/pandoc-2.7.3-linux.tar.gz && \
    tar -xf pandoc-2.7.3-linux.tar.gz && \
    cp pandoc-2.7.3/bin/* /usr/bin/ && \
    pandoc -v && \
    rm -rf pandoc-2.7.3-linux.tar.gz pandoc-2.7.3

WORKDIR /app
COPY --from=builder /app/public .
COPY --from=builder /app/dist .
COPY --from=builder /app/node_modules ./node_modules
