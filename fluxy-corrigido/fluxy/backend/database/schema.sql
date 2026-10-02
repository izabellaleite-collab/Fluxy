-- ============================================================
-- Fluxy — schema do banco (PostgreSQL 14+)
-- Pode ser executado mais de uma vez sem erro (idempotente).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE papel_usuario AS ENUM ('admin', 'gerente', 'operador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_categoria AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_transacao AS ENUM ('entrada', 'saida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_conta AS ENUM ('pagar', 'receber');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE status_conta AS ENUM ('pendente', 'pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_evento_agenda AS ENUM
        ('entrega', 'compra', 'fornecedor', 'reuniao', 'compromisso', 'feriado', 'importante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- empresa e acesso ----------

CREATE TABLE IF NOT EXISTS empresa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social    VARCHAR(150) NOT NULL,
    nome_fantasia   VARCHAR(150),
    cnpj            VARCHAR(18) UNIQUE,
    segmento        VARCHAR(100),
    telefone        VARCHAR(20),
    email           VARCHAR(150),
    endereco        VARCHAR(200),
    cidade          VARCHAR(100),
    estado          CHAR(2),
    cep             VARCHAR(9),
    logotipo_url    VARCHAR(300),
    fuso_horario    VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id                  UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nome                        VARCHAR(120) NOT NULL,
    email                       VARCHAR(150) NOT NULL UNIQUE,
    senha_hash                  VARCHAR(255) NOT NULL,
    telefone                    VARCHAR(20),
    cpf                         VARCHAR(14),
    avatar                      VARCHAR(10),
    papel                       papel_usuario NOT NULL DEFAULT 'admin',
    pergunta_seguranca          VARCHAR(200),
    resposta_seguranca_hash     VARCHAR(255),
    autenticacao_dois_fatores   BOOLEAN NOT NULL DEFAULT FALSE,
    ativo                       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em       TIMESTAMPTZ NOT NULL,
    revogado_em     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS historico_acesso (
    id              BIGSERIAL PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    data_acesso     TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispositivo     VARCHAR(150),
    endereco_ip     INET,
    sucesso         BOOLEAN NOT NULL DEFAULT TRUE
);

-- token de "esqueci minha senha", trocado logo depois que a pergunta de
-- seguranca e respondida certo; nao depende de e-mail chegar.
CREATE TABLE IF NOT EXISTS redefinicao_senha (
    id              BIGSERIAL PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em       TIMESTAMPTZ NOT NULL,
    utilizado       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- modulos do sistema ----------

CREATE TABLE IF NOT EXISTS modulo_sistema (
    id              SMALLSERIAL PRIMARY KEY,
    chave           VARCHAR(50) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    descricao       VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS empresa_modulo (
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    modulo_id       SMALLINT NOT NULL REFERENCES modulo_sistema(id) ON DELETE CASCADE,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (empresa_id, modulo_id)
);

CREATE TABLE IF NOT EXISTS configuracao_empresa (
    empresa_id              UUID PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
    moeda                   VARCHAR(3) NOT NULL DEFAULT 'BRL',
    tema                    VARCHAR(20) NOT NULL DEFAULT 'claro',
    notificar_contas        BOOLEAN NOT NULL DEFAULT TRUE,
    notificar_eventos       BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- cadastros ----------

CREATE TABLE IF NOT EXISTS categoria (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nome            VARCHAR(80) NOT NULL,
    tipo            tipo_categoria NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS cliente (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    email           VARCHAR(150),
    telefone        VARCHAR(20),
    observacoes     TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fornecedor (
    id                      BIGSERIAL PRIMARY KEY,
    empresa_id              UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nome                    VARCHAR(150) NOT NULL,
    documento               VARCHAR(18),
    telefone                VARCHAR(20),
    email                   VARCHAR(150),
    cidade                  VARCHAR(100),
    estado                  CHAR(2),
    categoria_fornecida     VARCHAR(100),
    observacoes             TEXT,
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- estoque ----------

CREATE TABLE IF NOT EXISTS produto (
    id                  BIGSERIAL PRIMARY KEY,
    empresa_id          UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    fornecedor_id       BIGINT REFERENCES fornecedor(id) ON DELETE SET NULL,
    codigo              VARCHAR(50),
    codigo_barras       VARCHAR(50),
    nome                VARCHAR(150) NOT NULL,
    categoria           VARCHAR(100),
    quantidade          INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    quantidade_minima   INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_minima >= 0),
    preco_custo         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
    preco_venda         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, codigo)
);

-- produto_nome fica gravado aqui (copia do nome no momento do movimento) para
-- o historico continuar legivel mesmo se o produto for excluido depois -
-- e exatamente o que a tela de estoque ja faz hoje no localStorage.
CREATE TABLE IF NOT EXISTS movimentacao_estoque (
    id                  BIGSERIAL PRIMARY KEY,
    empresa_id          UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    produto_id          BIGINT REFERENCES produto(id) ON DELETE SET NULL,
    produto_nome        VARCHAR(150) NOT NULL,
    tipo                tipo_movimentacao NOT NULL,
    quantidade          INTEGER NOT NULL CHECK (quantidade > 0),
    data_movimentacao   DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao          VARCHAR(200),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- financeiro ----------

CREATE TABLE IF NOT EXISTS transacao (
    id                  BIGSERIAL PRIMARY KEY,
    empresa_id          UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    categoria_id        BIGINT REFERENCES categoria(id) ON DELETE SET NULL,
    cliente_id          BIGINT REFERENCES cliente(id) ON DELETE SET NULL,
    tipo                tipo_transacao NOT NULL,
    descricao           VARCHAR(200) NOT NULL,
    valor               NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    data_transacao      DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conta (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    tipo            tipo_conta NOT NULL,
    descricao       VARCHAR(200) NOT NULL,
    valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    vencimento      DATE NOT NULL,
    status          status_conta NOT NULL DEFAULT 'pendente',
    pago_em         TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servico (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    cliente_id      BIGINT REFERENCES cliente(id) ON DELETE SET NULL,
    descricao       VARCHAR(200) NOT NULL,
    valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    data_servico    DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- agenda ----------

CREATE TABLE IF NOT EXISTS evento_agenda (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    titulo          VARCHAR(150) NOT NULL,
    tipo            tipo_evento_agenda NOT NULL DEFAULT 'compromisso',
    data_evento     DATE NOT NULL,
    horario         TIME,
    descricao       VARCHAR(300),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- indices ----------

CREATE INDEX IF NOT EXISTS idx_usuario_empresa           ON usuario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sessao_usuario             ON sessao(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessao_expira              ON sessao(expira_em);
CREATE INDEX IF NOT EXISTS idx_historico_usuario_data      ON historico_acesso(usuario_id, data_acesso DESC);
CREATE INDEX IF NOT EXISTS idx_redefinicao_usuario         ON redefinicao_senha(usuario_id);

CREATE INDEX IF NOT EXISTS idx_categoria_empresa_tipo      ON categoria(empresa_id, tipo);

CREATE INDEX IF NOT EXISTS idx_cliente_empresa             ON cliente(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cliente_nome                ON cliente(nome);

CREATE INDEX IF NOT EXISTS idx_fornecedor_empresa          ON fornecedor(empresa_id);

CREATE INDEX IF NOT EXISTS idx_produto_empresa             ON produto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_fornecedor          ON produto(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_produto_estoque_baixo       ON produto(empresa_id) WHERE quantidade <= quantidade_minima;

CREATE INDEX IF NOT EXISTS idx_movimentacao_produto_data   ON movimentacao_estoque(produto_id, data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacao_empresa_data   ON movimentacao_estoque(empresa_id, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_transacao_empresa_data      ON transacao(empresa_id, data_transacao DESC);
CREATE INDEX IF NOT EXISTS idx_transacao_categoria         ON transacao(categoria_id);
CREATE INDEX IF NOT EXISTS idx_transacao_cliente           ON transacao(cliente_id);

CREATE INDEX IF NOT EXISTS idx_conta_empresa_vencimento    ON conta(empresa_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_conta_status                ON conta(status);

CREATE INDEX IF NOT EXISTS idx_servico_empresa_data        ON servico(empresa_id, data_servico DESC);
CREATE INDEX IF NOT EXISTS idx_servico_cliente              ON servico(cliente_id);

CREATE INDEX IF NOT EXISTS idx_evento_empresa_data          ON evento_agenda(empresa_id, data_evento);

CREATE INDEX IF NOT EXISTS idx_empresa_modulo_empresa       ON empresa_modulo(empresa_id);

-- lista fixa de modulos do menu (nao falha se ja existir)
INSERT INTO modulo_sistema (chave, nome, descricao) VALUES
    ('dashboard',    'Dashboard',    'Painel geral com indicadores financeiros'),
    ('financeiro',   'Financeiro',   'Entradas e saidas'),
    ('contas',       'Contas',       'Contas a pagar e a receber'),
    ('estoque',      'Estoque',      'Controle de produtos e movimentacoes'),
    ('clientes',     'Clientes',     'Cadastro de clientes'),
    ('fornecedores', 'Fornecedores', 'Cadastro de fornecedores'),
    ('servicos',     'Servicos',     'Servicos prestados'),
    ('agenda',       'Agenda',       'Compromissos e datas importantes'),
    ('calendario',   'Calendario',   'Visualizacao mensal/semanal da agenda'),
    ('relatorios',   'Relatorios',   'Relatorios financeiros e de estoque')
ON CONFLICT (chave) DO NOTHING;
