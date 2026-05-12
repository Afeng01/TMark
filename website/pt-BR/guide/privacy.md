# Privacidade

> TMark snapshot note: this inherited privacy page is not authoritative until TMark release infrastructure is published. The current app update endpoint points to GitHub Releases, and public stats are disabled by default.

O TMark respeita sua privacidade. Aqui está exatamente o que acontece — e o que não acontece.

## O que o TMark Envia

O TMark inclui um **verificador de atualizações automático** que periodicamente contata nosso servidor para verificar se uma nova versão está disponível. Esta é a **única** solicitação de rede que o TMark faz.

Cada verificação envia exatamente estes campos — nada mais:

| Dado | Exemplo | Finalidade |
|------|---------|-----------|
| Endereço IP | `203.0.113.42` | Inerente a qualquer solicitação HTTP — não podemos não recebê-lo |
| SO | `darwin`, `windows`, `linux` | Para servir o pacote de atualização correto |
| Arquitetura | `aarch64`, `x86_64` | Para servir o pacote de atualização correto |
| Versão do app | `0.5.10` | Para determinar se há uma atualização disponível |
| Hash da máquina | `a3f8c2...` (hex de 64 caracteres) | Contador anônimo de dispositivos — SHA-256 do hostname + SO + arch; não reversível |

A URL completa fica assim:

```text
GET https://github.com/Afeng01/TMark/releases/latest/download/latest.json?target=darwin&arch=aarch64&version=0.5.10
X-Machine-Id: a3f8c2b1d4e5f6078a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1
```

Você pode verificar isso por conta própria — o endpoint está em [`tauri.conf.json`](https://github.com/Afeng01/TMark/blob/main/src-tauri/tauri.conf.json) (pesquise por `"endpoints"`), e o hash está em [`lib.rs`](https://github.com/Afeng01/TMark/blob/main/src-tauri/src/lib.rs) (pesquise por `machine_id_hash`).

## O que o TMark NÃO Envia

- Seus documentos ou seus conteúdos
- Nomes ou caminhos de arquivo
- Padrões de uso ou análises de recursos
- Informações pessoais de qualquer tipo
- Relatórios de falhas
- Dados de teclas pressionadas ou edição
- Identificadores de hardware reversíveis ou impressões digitais
- O hash da máquina é um resumo SHA-256 unidirecional — não pode ser revertido para recuperar seu hostname ou qualquer outra entrada

## Como Usamos os Dados

Agregamos os logs de verificação de atualização para produzir as estatísticas ao vivo mostradas em nossa [página inicial](/pt-BR/):

| Métrica | Como é calculada |
|---------|-----------------|
| **Dispositivos únicos** | Contagem de hashes de máquina distintos por dia/semana/mês |
| **IPs únicos** | Contagem de endereços IP distintos por dia/semana/mês |
| **Pings** | Número total de solicitações de verificação de atualização |
| **Plataformas** | Contagem de pings por combinação de SO + arquitetura |
| **Versões** | Contagem de pings por versão do app |

Esses números são publicados abertamente em [`configured stats endpoint`](https://github.com/Afeng01/TMark/releases). Nada está oculto.

**Ressalvas importantes:**
- IPs únicos subestimam os usuários reais — várias pessoas atrás do mesmo roteador/VPN contam como uma
- Dispositivos únicos fornecem contagens mais precisas, mas uma mudança de hostname ou instalação nova do SO gera um novo hash
- Pings superestimam os usuários reais — uma pessoa pode verificar várias vezes por dia

## Retenção de Dados

- Os logs são armazenados no nosso servidor no formato de log de acesso padrão
- Os arquivos de log rotacionam em 1 MB e apenas os 3 arquivos mais recentes são mantidos
- Os logs não são compartilhados com ninguém
- Não há sistema de conta — o TMark não sabe quem você é
- O hash da máquina não está vinculado a nenhuma conta, e-mail ou endereço IP — é apenas um contador pseudônimo de dispositivos
- Não usamos cookies de rastreamento, impressão digital ou qualquer SDK de análise

## Transparência de Código Aberto

O TMark é totalmente de código aberto. Você pode verificar tudo descrito aqui:

- Configuração do endpoint de atualização: [`src-tauri/tauri.conf.json`](https://github.com/Afeng01/TMark/blob/main/src-tauri/tauri.conf.json)
- Geração do hash da máquina: [`src-tauri/src/lib.rs`](https://github.com/Afeng01/TMark/blob/main/src-tauri/src/lib.rs) — pesquise por `machine_id_hash`
- Agregação de estatísticas no lado do servidor: [`scripts/tmark-stats-json`](https://github.com/Afeng01/TMark/blob/main/scripts/tmark-stats-json) — o script exato que roda no nosso servidor para produzir as [estatísticas públicas](https://github.com/Afeng01/TMark/releases)
- Nenhuma outra chamada de rede existe na base de código — pesquise por `fetch`, `http` ou `reqwest` você mesmo

## Desabilitando Verificações de Atualização

Se preferir desabilitar as verificações automáticas de atualização completamente, você pode bloquear the configured update endpoint no nível da rede (firewall, `/etc/hosts` ou DNS). O TMark continuará funcionando normalmente sem isso — você simplesmente não receberá notificações de atualização.
