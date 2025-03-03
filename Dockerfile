# Use uma imagem oficial do Node.js como base
FROM node:20

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos package.json e package-lock.json
COPY package*.json ./

# Instale as dependências
RUN npm install -g nodemon
RUN npm install

# Copie o restante dos arquivos do projeto
COPY . .

# Exponha a porta que o aplicativo usará
EXPOSE 3000

# Comando para iniciar o aplicativo
CMD ["npm", "run", "dev"]
