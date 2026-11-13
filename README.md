# Perdido no tempo

Jogo STEAM (SESI) sobre o **Seu Antônio**, um aposentado de 72 anos que ganha R$ 1.400 e chega a Nova Aurora, uma cidade hipertecnológica. Cada escolha mexe no **saldo** e na **paciência** dele e leva a minigames: totem de autoatendimento, Pix (com golpe no meio), QR code e assistente de voz. Os finais misturam crítica e esperança.

O controle é a **mão do jogador** na frente de um **sensor ultrassônico HC-SR04** ligado a um **ESP32**. O jogo roda no navegador e conversa com a placa pelo cabo USB (Web Serial). Sem placa, dá para jogar no teclado.

| Arquivo | O que é |
|---------|---------|
| [MANUAL_MONTAGEM.md](MANUAL_MONTAGEM.md) | Como montar e gravar o controle, passo a passo |
| [plan.md](plan.md) | Plano do projeto: roteiro, minigames, arquitetura, protocolo, fases |
| `firmware/perdido_controle/` | Código do ESP32 (Arduino IDE) |
| `index.html`, `style.css`, `js/` | O jogo (site estático, sem build) |
| `tools/` | Testes do protocolo e simulação do firmware |

## Como jogar

- **Mão no sensor:** cada faixa de distância é uma opção (a de cima é a mais perto). **Mão parada ~1 s** confirma. **Toquinho rápido no ar** (aproximar e tirar) volta ou fecha propagandas.
- **Botão BOOT** da placa: confirma na hora.
- **Teclado:** ↑ ↓ escolhem, Enter confirma, Esc volta. **Q / E / R** simulam a mão (aproximar, afastar, tirar).

## Rodar no computador

O jogo usa módulos JavaScript, então precisa de um servidorzinho local (abrir o `index.html` com dois cliques **não** funciona).

```bash
# opção 1 (Node instalado)
npx serve .
# opção 2 (Python instalado)
python -m http.server 5173
```

Abra `http://localhost:5173` (ou o endereço que aparecer) no **Chrome** ou **Edge**. `localhost` conta como site seguro, então a Web Serial funciona.

## Conectar o controle

1. Grave o firmware (veja o manual) e **feche o Monitor Serial** da Arduino IDE.
2. No jogo, clique em **🔌 Conectar controle** e escolha a porta (CP210x, CH340...). Se a placa não aparecer, clique em **"não apareceu?"** para ver todas as portas.
3. Pronto. Da próxima vez, é só ligar o cabo: o jogo conecta sozinho, e se o cabo sair e voltar, ele reconecta.

## Publicar na Vercel

O projeto é um site estático: não tem build nem servidor.

**Pelo site (mais fácil):**
1. Suba esta pasta para um repositório no GitHub.
2. Entre em https://vercel.com, clique em **Add New → Project** e importe o repositório.
3. Em *Framework Preset* escolha **Other**. Deixe *Build Command* e *Output Directory* vazios.
4. Clique em **Deploy**. O link fica algo como `https://perdido-no-tempo.vercel.app`.

**Pelo terminal:**
```bash
npm i -g vercel
vercel          # primeira vez: responde as perguntas (tudo padrão)
vercel --prod   # publica
```

O `vercel.json` já libera a Web Serial (`Permissions-Policy: serial=(self)`). A Vercel usa HTTPS, que a Web Serial exige. O `.vercelignore` deixa o firmware e os testes fora do site.

## Testes

```bash
npm test                 # protocolo serial, zonas da mão, toquinho (Node 18+)
npm run test:firmware    # compila o firmware com um Arduino simulado (precisa de g++)
```

## Navegadores

| Navegador | Controle USB | Teclado |
|-----------|:-----------:|:-------:|
| Chrome / Edge (computador) | ✅ | ✅ |
| Firefox, Safari, celular | ❌ (aparece um aviso) | ✅ |
