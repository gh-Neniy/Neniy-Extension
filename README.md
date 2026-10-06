### Что это

Это расширение для vs code / cursor для языка Neniy. Оно добавляет подсветку синтаксиса и подчеркивание ошибок, с выводом сообщения ошибки. Разработано специально для языка Neniy.

### Установка

В корне проекта
```
sudo apt install npm node-typescript
npm install --save-dev @types/node

npm run compile
vsce package
```

Полученный файл .vsix - и есть расширение.  
Его можно установить сразу

```
code --install-extension <name>.vsix
```
или
```
cursor --install-extension <name>.vsix
```
