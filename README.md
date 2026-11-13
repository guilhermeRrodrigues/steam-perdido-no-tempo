# Perdido no tempo

Jogo STEAM (SESI) sobre o **Seu Antônio**, um aposentado de 72 anos que ganha R$ 1.400 e chega a Nova Aurora, uma cidade hipertecnológica. Cada escolha mexe no **saldo** e na **paciência** dele e leva a minigames: totem de autoatendimento, Pix (com golpe no meio), QR code e assistente de voz. Os finais misturam crítica e esperança.

O controle é a **mão do jogador** na frente de um **sensor ultrassônico HC-SR04** ligado a um **ESP32**. O jogo roda no navegador e conversa com a placa pelo **cabo USB** (Web Serial) ou por **Bluetooth** (Web Bluetooth, sem precisar de driver). Sem placa, dá para jogar no teclado.

| Arquivo | O que é |
|---------|---------|
| [MANUAL_MONTAGEM.md](MANUAL_MONTAGEM.md) | Como montar e gravar o controle, passo a passo |
| [plan.md](plan.md) | Plano do projeto: roteiro, minigames, arquitetura, protocolo, fases |
| `firmware/perdido_controle/` | Código do ESP32 (Arduino) |
| `gravar.html`, `gravar/` | Página que grava o firmware pelo navegador (ESP Web Tools) e o `.bin` compilado |
| `.github/workflows/firmware.yml` | Compila o firmware no GitHub e salva o `.bin` em `gravar/` |
| `vendor/esp-web-tools/` | Cópia do ESP Web Tools 10.5.2 (Apache-2.0), para não depender de CDN |
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

## Gravar o firmware sem instalar nada

1. O GitHub compila o firmware sozinho (aba **Actions** → "Compilar firmware") sempre que algo em `firmware/` muda na `main`, e salva o resultado em `gravar/perdido_controle.bin`. Para rodar na mão: **Actions → Compilar firmware → Run workflow**.
2. A Vercel publica de novo com o `.bin` novo.
3. Abra `https://SEU-SITE.vercel.app/gravar` no Chrome/Edge (ou no Chrome de um celular Android com cabo OTG), clique em **Gravar firmware no ESP32** e escolha a porta.

**O computador não mostra a porta (driver CP2102/CH340 faltando e sem senha de administrador)?** Grave a placa uma vez pelo celular Android ou em outro computador, e jogue por Bluetooth. Detalhes na seção 5 do [manual](MANUAL_MONTAGEM.md).

Alternativas: Arduino IDE em versão ZIP (portátil) e Arduino Cloud Editor, também explicadas no manual. Na Arduino IDE, use **Partition Scheme → Huge APP**, por causa do Bluetooth.

## Conectar o controle

**Pelo cabo USB** (precisa do driver do chip USB):
1. **Feche o Monitor Serial** da Arduino IDE, se estiver aberto.
2. No jogo, clique em **🔌 Conectar controle** e escolha a porta (CP210x, CH340...). Se a placa não aparecer, clique em **"não apareceu?"** para ver todas as portas.
3. Da próxima vez, é só ligar o cabo: o jogo conecta sozinho, e se o cabo sair e voltar, ele reconecta.

**Por Bluetooth** (não precisa de driver nem de parear no Windows):
1. Ligue a placa (no USB só para energia, ou num carregador).
2. Clique em **📶 Conectar por Bluetooth** e escolha **PerdidoNoTempo**.
3. Se cair, o jogo tenta reconectar sozinho.

## Publicar na Vercel

O projeto é um site estático: não tem build nem servidor. O `vercel.json` na **raiz** do repositório já diz isso para a Vercel (sem framework, sem instalação, sem build, publicar a própria raiz), então não é preciso mudar nada na tela de importação.

**Pelo site:**
1. Em https://vercel.com, clique em **Add New… → Project** e, em *Import Git Repository*, escolha **steam-perdido-no-tempo** → **Import**.
2. Na tela *Configure Project*, deixe assim:

   | Campo | O que escolher |
   |-------|----------------|
   | Project Name | `perdido-no-tempo` (ou o nome que quiser; vira o link) |
   | Framework Preset | **Other** |
   | Root Directory | **`./`** (a raiz; não escolha nenhuma pasta) |
   | Build and Output Settings | **não mexa**: o `vercel.json` já desliga o build e a instalação |
   | Environment Variables | nenhuma |

   A Vercel não mostra um aviso de "vercel.json detectado" nessa tela: ela só lê o arquivo na hora do deploy.
3. Clique em **Deploy**. O link fica algo como `https://perdido-no-tempo.vercel.app`, e a página de gravação em `https://perdido-no-tempo.vercel.app/gravar`.
4. Cada push na `main` publica de novo sozinho. Quando o firmware muda, o GitHub Actions salva o `.bin` novo em `gravar/` e a Vercel publica outra vez.

**Conferir se deu certo:** abra o link, aperte F12 → *Network*, recarregue e clique em `index.html` (ou no primeiro item): em *Response Headers* deve aparecer `permissions-policy: serial=(self), bluetooth=(self), usb=(self)`. Isso mostra que o `vercel.json` foi usado.

**Se o deploy já existia com outras configurações:** em *Project → Settings → Build and Deployment*, deixe Framework Preset em **Other**, desligue os *Override* de Build/Output/Install, confira o *Root Directory* vazio e faça **Redeploy**.

**Pelo terminal (opcional):**
```bash
npx vercel          # primeira vez: responde as perguntas (tudo padrão)
npx vercel --prod   # publica
```

O `.vercelignore` deixa o firmware, os testes e os `.md` fora do site.

## Testes

```bash
npm test                 # protocolo serial, zonas da mão, toquinho (Node 18+)
npm run test:firmware    # compila o firmware com um Arduino simulado (precisa de g++)
```

## Navegadores

| Navegador | Controle USB | Bluetooth | Gravar firmware | Teclado |
|-----------|:-----------:|:---------:|:---------------:|:-------:|
| Chrome / Edge (computador) | ✅ | ✅ | ✅ | ✅ |
| Chrome (Android) | ❌ | ✅ | ✅ (cabo OTG) | ❌ |
| Firefox, Safari | ❌ (aparece um aviso) | ❌ | ❌ | ✅ |
