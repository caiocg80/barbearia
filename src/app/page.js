'use client';

import React, { useState, useEffect } from 'react';

const HORA_ABERTURA = 9;   // 09:00
const HORA_FECHAMENTO = 19; // 19:00
const DIA_FECHADO = 0;      // Domingo
const INTERVALO_MINUTOS = 30;
const DIAS_A_FRENTE = 30;

// Serviços oficiais da HG BARBER CLUB (Cabelo + Barba sem desconto a R$ 65)
const SERVICOS = [
  // CORTES E COMBOS
  { id: '1', categoria: 'CORTES E ACABAMENTOS', nome: 'Degradê', preco: 'R$ 35', duracaoMin: 30, icon: '💈' },
  { id: '2', categoria: 'CORTES E ACABAMENTOS', nome: 'Social', preco: 'R$ 35', duracaoMin: 30, icon: '✂️' },
  { id: '3', categoria: 'CORTES E ACABAMENTOS', nome: 'Cabelo + Barba', preco: 'R$ 65', duracaoMin: 60, icon: '👑' },
  { id: '4', categoria: 'CORTES E ACABAMENTOS', nome: 'Barba', preco: 'R$ 30', duracaoMin: 30, icon: '🧔' },
  { id: '5', categoria: 'CORTES E ACABAMENTOS', nome: 'Pezinho', preco: 'R$ 10', duracaoMin: 30, icon: '🪒' },
  { id: '6', categoria: 'CORTES E ACABAMENTOS', nome: 'Sobrancelha', preco: 'R$ 10', duracaoMin: 30, icon: '✨' },

  // QUÍMICA E COLORAÇÃO
  { id: '7', categoria: 'QUÍMICA E COLORAÇÃO', nome: 'Alisamento', preco: 'R$ 70', duracaoMin: 60, icon: '🧴' },
  { id: '8', categoria: 'QUÍMICA E COLORAÇÃO', nome: 'Luzes', preco: 'R$ 150', duracaoMin: 90, icon: '⚡' },
  { id: '9', categoria: 'QUÍMICA E COLORAÇÃO', nome: 'Nevou', preco: 'R$ 180', duracaoMin: 120, icon: '❄️' },
];

const SEMANA_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const minParaHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const horaParaMin = (hStr) => {
  const [h, m] = hStr.split(':').map(Number);
  return h * 60 + m;
};

export default function AgendamentoApp() {
  const [dias, setDias] = useState([]);
  const [dataSel, setDataSel] = useState('');
  const [horaSel, setHoraSel] = useState(null);
  const [slots, setSlots] = useState({ manha: [], tarde: [] });
  const [ocupados, setOcupados] = useState([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [servicoSel, setServicoSel] = useState(SERVICOS[2]); // Cabelo + Barba
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [erro, setErro] = useState('');

  const [tela, setTela] = useState('agendar');
  const [sucessoData, setSucessoData] = useState(null);

  // 1. Gera os 30 dias do calendário
  useEffect(() => {
    const lista = [];
    const hoje = new Date();
    for (let i = 0; i < DIAS_A_FRENTE; i++) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dow = d.getDay();
      lista.push({
        iso,
        diaNum: d.getDate(),
        mesNome: MESES_ABREV[d.getMonth()],
        semana: i === 0 ? 'HOJE' : SEMANA_ABREV[dow],
        fechado: dow === DIA_FECHADO,
      });
    }
    setDias(lista);
    const prim = lista.find((d) => !d.fechado);
    if (prim) setDataSel(prim.iso);
  }, []);

  // 2. Procura agendamentos na base de dados para o dia escolhido
  useEffect(() => {
    if (!dataSel) return;
    setCarregandoHorarios(true);
    fetch(`/api/agendamentos?data=${dataSel}`)
      .then((res) => res.json())
      .then((dados) => {
        if (dados.ocupados) {
          setOcupados(dados.ocupados);
        }
      })
      .catch(() => setOcupados([]))
      .finally(() => setCarregandoHorarios(false));
  }, [dataSel]);

  // 3. Monta e valida os slots com bloqueio de duração e conflito
  useEffect(() => {
    if (!dataSel) return;
    setHoraSel(null);

    const mList = [];
    const tList = [];
    const fechoMin = HORA_FECHAMENTO * 60;
    const duracaoAtual = servicoSel.duracaoMin;

    for (let m = HORA_ABERTURA * 60; m < fechoMin; m += INTERVALO_MINUTOS) {
      const horaStr = minParaHora(m);
      const fimPretendido = m + duracaoAtual;

      const cabeExpediente = fimPretendido <= fechoMin;

      const temConflito = ocupados.some((ocup) => {
        return m < ocup.fimMin && fimPretendido > ocup.inicioMin;
      });

      const disponivel = cabeExpediente && !temConflito;

      const slotObj = {
        hora: horaStr,
        disponivel,
        motivo: !cabeExpediente ? 'Ultrapassa fecho' : temConflito ? 'Ocupado' : 'Livre',
      };

      if (m < 12 * 60) mList.push(slotObj);
      else tList.push(slotObj);
    }

    setSlots({ manha: mList, tarde: tList });
  }, [dataSel, servicoSel, ocupados]);

  function formatarTel(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    const c = d.length > 10 ? 7 : 6;
    return `(${d.slice(0, 2)}) ${d.slice(2, c)}${d.slice(c) ? '-' + d.slice(c) : ''}`;
  }

  const horaFimCalculada = horaSel 
    ? minParaHora(horaParaMin(horaSel) + servicoSel.duracaoMin)
    : null;

  async function handleAgendar(e) {
    e.preventDefault();
    setErro('');

    if (!horaSel) {
      setErro('Por favor, selecione um horário disponível.');
      return;
    }
    if (!nome.trim()) {
      setErro('Informe o seu nome completo.');
      return;
    }
    if (whatsapp.replace(/\D/g, '').length < 10) {
      setErro('Informe um número de WhatsApp com DDD válido.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          whatsapp,
          data: dataSel,
          horaInicio: horaSel,
          servicoNome: servicoSel.nome,
          servicoPreco: servicoSel.preco,
          duracaoMin: servicoSel.duracaoMin,
        }),
      });

      const resposta = await res.json();

      if (!res.ok) {
        setErro(resposta.erro || 'Não foi possível agendar.');
        setEnviando(false);
        fetch(`/api/agendamentos?data=${dataSel}`)
          .then((r) => r.json())
          .then((d) => d.ocupados && setOcupados(d.ocupados));
        return;
      }

      setSucessoData({
        nome,
        whatsapp,
        dia: dataSel,
        horaInicio: horaSel,
        horaFim: horaFimCalculada,
        duracao: servicoSel.duracaoMin,
        servico: servicoSel.nome,
        preco: servicoSel.preco,
      });

      setTela('sucesso');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErro('Erro de conexão ao salvar seu horário. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  const cortesAcabamentos = SERVICOS.filter((s) => s.categoria === 'CORTES E ACABAMENTOS');
  const quimicaColoracao = SERVICOS.filter((s) => s.categoria === 'QUÍMICA E COLORAÇÃO');

  return (
    <div className="app-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Oswald:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="top-stripe" />

      {/* HEADER OFICIAL COM LOGO HG BARBER CLUB */}
      <header className="hero-header">
        <div className="brand-poster">
          <div className="logo-lockup">
            <div className="hg-gold">HG</div>
            <div className="barber-box">
              <span className="barber-text">BARBER</span>
              <div className="club-row">
                <span className="line" />
                <span className="club-text">CLUB</span>
                <span className="line" />
              </div>
            </div>
          </div>

          <div className="gold-arch" />

          <div className="slogan-row">
            <span>CORTES</span>
            <span className="slogan-dot">•</span>
            <span>BARBA</span>
            <span className="slogan-dot">•</span>
            <span>SOBRANCELHA</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-desmarcar-topo"
          onClick={() => setTela(tela === 'agendar' ? 'cancelar' : 'agendar')}
        >
          {tela === 'agendar' ? 'Desmarcar horário' : 'Voltar ao agendamento'}
        </button>
      </header>

      {/* TELA PRINCIPAL: AGENDAMENTO */}
      {tela === 'agendar' && (
        <form onSubmit={handleAgendar} className="content-container">
          
          {/* SEÇÃO 1: TABELA DE SERVIÇOS */}
          <section className="section-frame">
            <div className="section-header">
              <span className="badge-num">1</span>
              <div>
                <h2>TABELA DE SERVIÇOS</h2>
                <small>Toque para escolher seu procedimento</small>
              </div>
            </div>

            {/* Cortes e Acabamentos */}
            <div className="category-block">
              <span className="category-title">CORTES E COMBOS</span>
              <div className="services-grid">
                {cortesAcabamentos.map((s) => {
                  const ativo = servicoSel.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServicoSel(s)}
                      className={`service-card ${ativo ? 'active' : ''}`}
                    >
                      <div className="s-info">
                        <span className="s-icon">{s.icon}</span>
                        <div>
                          <span className="s-name">{s.nome}</span>
                          <span className="s-duracao">{s.duracaoMin} min</span>
                        </div>
                      </div>
                      <span className="s-price">{s.preco}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Química e Coloração */}
            <div className="category-block" style={{ marginTop: '16px' }}>
              <span className="category-title">QUÍMICA E COLORAÇÃO</span>
              <div className="services-grid">
                {quimicaColoracao.map((s) => {
                  const ativo = servicoSel.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServicoSel(s)}
                      className={`service-card ${ativo ? 'active' : ''}`}
                    >
                      <div className="s-info">
                        <span className="s-icon">{s.icon}</span>
                        <div>
                          <span className="s-name">{s.nome}</span>
                          <span className="s-duracao">{s.duracaoMin} min</span>
                        </div>
                      </div>
                      <span className="s-price">{s.preco}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: DIAS */}
          <section className="section-frame">
            <div className="section-header">
              <span className="badge-num">2</span>
              <div>
                <h2>ESCOLHA O DIA</h2>
                <small>Segunda a Sábado • Fechado aos Domingos</small>
              </div>
            </div>

            <div className="days-carousel">
              {dias.map((d) => {
                const ativo = dataSel === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    disabled={d.fechado}
                    onClick={() => setDataSel(d.iso)}
                    className={`day-chip ${ativo ? 'active' : ''} ${d.fechado ? 'closed' : ''}`}
                  >
                    <span className="d-weekday">{d.semana}</span>
                    <strong className="d-number">{d.diaNum}</strong>
                    <span className="d-month">{d.fechado ? 'Fechado' : d.mesNome}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SEÇÃO 3: HORÁRIOS */}
          <section className="section-frame">
            <div className="section-header">
              <span className="badge-num">3</span>
              <div>
                <h2>HORÁRIO DE INÍCIO</h2>
                <small>
                  {carregandoHorarios
                    ? 'Verificando horários...'
                    : `Duração necessária: ${servicoSel.duracaoMin} minutos (${servicoSel.duracaoMin / 30} horários)`}
                </small>
              </div>
            </div>

            {/* Manhã */}
            <div className="time-group">
              <div className="time-header">
                <span>☕ Período da Manhã</span>
                <small>09:00 às 11:30</small>
              </div>
              <div className="hours-grid">
                {slots.manha.map((slot) => (
                  <button
                    key={slot.hora}
                    type="button"
                    disabled={!slot.disponivel}
                    onClick={() => setHoraSel(slot.hora)}
                    className={`hour-btn ${horaSel === slot.hora ? 'active' : ''} ${!slot.disponivel ? 'disabled' : ''}`}
                  >
                    <span>{slot.hora}</span>
                    {!slot.disponivel && (
                      <small className="slot-badge-busy">
                        {slot.motivo === 'Ocupado' ? 'Ocupado' : 'Indisponível'}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarde */}
            <div className="time-group" style={{ marginTop: '14px' }}>
              <div className="time-header">
                <span>✂️ Período da Tarde</span>
                <small>12:00 às 18:30</small>
              </div>
              <div className="hours-grid">
                {slots.tarde.map((slot) => (
                  <button
                    key={slot.hora}
                    type="button"
                    disabled={!slot.disponivel}
                    onClick={() => setHoraSel(slot.hora)}
                    className={`hour-btn ${horaSel === slot.hora ? 'active' : ''} ${!slot.disponivel ? 'disabled' : ''}`}
                  >
                    <span>{slot.hora}</span>
                    {!slot.disponivel && (
                      <small className="slot-badge-busy">
                        {slot.motivo === 'Ocupado' ? 'Ocupado' : 'Indisponível'}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* SEÇÃO 4: DADOS DO CLIENTE */}
          <section className="section-frame" style={{ marginBottom: '110px' }}>
            <div className="section-header">
              <span className="badge-num">4</span>
              <div>
                <h2>SEUS DADOS</h2>
                <small>Confirmação enviada diretamente para o WhatsApp</small>
              </div>
            </div>

            <div className="inputs-stack">
              <div className="input-group">
                <label>Seu Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: João Victor"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="field-dark"
                />
              </div>

              <div className="input-group">
                <label>Seu WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(43) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatarTel(e.target.value))}
                  className="field-dark"
                />
              </div>
            </div>

            {erro && <div className="error-box">{erro}</div>}

            <div className="bottom-tagline">
              <span className="line" />
              <span>ESTILO É ATITUDE</span>
              <span className="line" />
            </div>
          </section>

          {/* BARRA FIXA COM RESUMO */}
          <div className="sticky-footer">
            <div className="footer-details">
              <span className="footer-serv">
                {servicoSel.nome} ({servicoSel.duracaoMin}m) • <b className="gold-text">{servicoSel.preco}</b>
              </span>
              <strong className="footer-time">
                {horaSel ? (
                  <>
                    {dataSel.split('-').reverse().slice(0, 2).join('/')} • {horaSel} às {horaFimCalculada}
                  </>
                ) : (
                  'Escolha um horário de início'
                )}
              </strong>
            </div>
            <button
              type="submit"
              disabled={!horaSel || enviando}
              className={`btn-checkout ${!horaSel || enviando ? 'disabled' : ''}`}
            >
              {enviando ? 'RESERVANDO...' : 'AGENDAR'}
            </button>
          </div>
        </form>
      )}

      {/* TELA DE SUCESSO */}
      {tela === 'sucesso' && sucessoData && (
        <div className="screen-center">
          <div className="ticket-card">
            <div className="check-gold">✓</div>
            <h2 className="ticket-title">AGENDAMENTO CONFIRMADO!</h2>
            <p className="ticket-sub">
              A vaga está garantida na <strong>HG BARBER CLUB</strong>. Toque abaixo para avisar pelo WhatsApp.
            </p>

            <div className="receipt-box">
              <div className="r-row"><span>Cliente:</span><strong>{sucessoData.nome}</strong></div>
              <div className="r-row"><span>WhatsApp:</span><strong>{sucessoData.whatsapp}</strong></div>
              <div className="r-row"><span>Serviço:</span><strong>{sucessoData.servico}</strong></div>
              <div className="r-row"><span>Duração:</span><strong>{sucessoData.duracao} minutos</strong></div>
              <div className="r-row"><span>Valor:</span><strong className="gold-text">{sucessoData.preco}</strong></div>
              <div className="r-row">
                <span>Data &amp; Horário:</span>
                <strong className="gold-text">
                  {sucessoData.dia.split('-').reverse().join('/')} das {sucessoData.horaInicio} às {sucessoData.horaFim}
                </strong>
              </div>
            </div>

            <a
              href={`https://wa.me/5543999024709?text=${encodeURIComponent(
                `Olá! Agendei um horário na *HG BARBER CLUB*:\n\n` +
                `💈 *Serviço:* ${sucessoData.servico} (${sucessoData.preco})\n` +
                `⏱️ *Tempo reservado:* ${sucessoData.duracao} minutos\n` +
                `👤 *Cliente:* ${sucessoData.nome}\n` +
                `📅 *Data:* ${sucessoData.dia.split('-').reverse().join('/')}\n` +
                `⏰ *Horário:* das ${sucessoData.horaInicio} às ${sucessoData.horaFim}\n\n` +
                `Confirmado no sistema!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp-action"
            >
              Confirmar no WhatsApp da Barbearia 💬
            </a>

            <button
              type="button"
              className="btn-secondary-link"
              onClick={() => {
                setTela('agendar');
                setHoraSel(null);
                fetch(`/api/agendamentos?data=${dataSel}`)
                  .then((r) => r.json())
                  .then((d) => d.ocupados && setOcupados(d.ocupados));
              }}
            >
              Fazer outro agendamento
            </button>
          </div>
        </div>
      )}

      {/* TELA DE CANCELAMENTO */}
      {tela === 'cancelar' && (
        <div className="screen-center">
          <div className="ticket-card">
            <h2 className="ticket-title">DESMARCAR HORÁRIO</h2>
            <p className="ticket-sub">Digite o WhatsApp utilizado no agendamento para consultar sua reserva.</p>
            <input
              type="tel"
              placeholder="(43) 99999-9999"
              className="field-dark"
              style={{ margin: '20px 0', textAlign: 'center', fontSize: '18px' }}
            />
            <button type="button" className="btn-checkout" style={{ width: '100%', marginBottom: '14px' }}>
              CONSULTAR MEU HORÁRIO
            </button>
            <button
              type="button"
              className="btn-secondary-link"
              onClick={() => setTela('agendar')}
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #121110;
          color: #f7f5f0;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .app-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at 50% 0%, #1f1d1a 0%, #100f0e 80%);
        }

        .top-stripe {
          height: 6px;
          background: repeating-linear-gradient(
            -45deg,
            #d4af37 0 12px,
            #171513 12px 20px,
            #ffffff 20px 24px,
            #171513 24px 32px
          );
        }

        .hero-header {
          padding: 24px 16px 18px;
          text-align: center;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          border-bottom: 1px solid rgba(212, 175, 55, 0.15);
          background: linear-gradient(180deg, rgba(28, 25, 22, 0.6) 0%, rgba(16, 15, 14, 0.95) 100%);
        }

        .brand-poster {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 420px;
          width: 100%;
        }

        .logo-lockup {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .hg-gold {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: 58px;
          line-height: 0.9;
          letter-spacing: -1px;
          background: linear-gradient(135deg, #f7df87 0%, #d4af37 40%, #aa771c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(212, 175, 55, 0.3));
        }

        .barber-box {
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .barber-text {
          font-family: 'Cinzel', serif;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 4px;
          color: #ffffff;
          line-height: 1;
        }

        .club-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }

        .club-row .line {
          flex: 1;
          height: 1px;
          background: #d4af37;
        }

        .club-text {
          font-family: 'Cinzel', serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 5px;
          color: #d4af37;
        }

        .gold-arch {
          width: 220px;
          height: 10px;
          border-bottom: 1.5px solid #d4af37;
          border-radius: 50%;
          margin: 6px 0 10px;
          opacity: 0.8;
        }

        .slogan-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #d4af37;
          text-transform: uppercase;
        }

        .slogan-dot { font-size: 8px; color: #8c8375; }

        .btn-desmarcar-topo {
          margin-top: 14px;
          background: transparent;
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: #bfb7aa;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-desmarcar-topo:hover {
          border-color: #d4af37;
          color: #fff;
        }

        .content-container {
          max-width: 600px;
          width: 100%;
          margin: 0 auto;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-frame {
          background: rgba(22, 20, 18, 0.95);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .badge-num {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f7df87, #aa771c);
          color: #12100e;
          font-weight: 800;
          font-size: 13px;
          display: grid;
          place-items: center;
        }

        .section-header h2 {
          font-family: 'Oswald', sans-serif;
          font-size: 16px;
          letter-spacing: 1px;
          color: #f7f3ea;
        }

        .section-header small {
          font-size: 12px;
          color: #8c8375;
          display: block;
        }

        .category-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .category-title {
          font-family: 'Oswald', sans-serif;
          font-size: 12.5px;
          letter-spacing: 1.5px;
          color: #d4af37;
          display: block;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 8px;
        }

        .service-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px 12px;
          min-height: 72px;
          background: #181614;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #f0ebe1;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .service-card:hover {
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.05);
        }

        .service-card.active {
          background: rgba(212, 175, 55, 0.16);
          border-color: #d4af37;
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.2);
        }

        .s-info {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .s-icon { font-size: 16px; margin-top: 2px; }
        .s-name { font-size: 13px; font-weight: 600; display: block; line-height: 1.2; }
        .s-duracao { font-size: 11px; color: #8c8375; display: block; margin-top: 2px; }
        .s-price { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #d4af37; margin-top: 4px; }

        .days-carousel {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
          scrollbar-width: none;
        }
        .days-carousel::-webkit-scrollbar { display: none; }

        .day-chip {
          flex: 0 0 62px;
          padding: 10px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #181614;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #cfc7bc;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .day-chip.active {
          background: linear-gradient(135deg, #f7df87, #aa771c);
          border-color: #f7df87;
          color: #12100e;
          font-weight: 700;
        }

        .day-chip.closed {
          opacity: 0.35;
          border-style: dashed;
          cursor: not-allowed;
        }

        .d-weekday { font-size: 10px; font-weight: 700; }
        .d-number { font-family: 'Oswald', sans-serif; font-size: 22px; margin: 2px 0; }
        .d-month { font-size: 10px; }

        .time-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #8c8375;
          margin-bottom: 8px;
        }

        .hours-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }

        .hour-btn {
          padding: 8px 0;
          background: #181614;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          color: #efe7d6;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 44px;
        }

        .hour-btn:hover:not(.disabled) {
          border-color: rgba(212, 175, 55, 0.4);
        }

        .hour-btn.active {
          background: #d4af37;
          color: #12100e;
          font-weight: 800;
          border-color: #d4af37;
        }

        .hour-btn.disabled {
          opacity: 0.35;
          border-style: dashed;
          cursor: not-allowed;
          background: #121110;
        }

        .slot-badge-busy {
          font-size: 9px;
          color: #fca5a5;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 1px;
        }

        .inputs-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 600;
          color: #a39a8a;
          text-transform: uppercase;
        }

        .field-dark {
          width: 100%;
          padding: 13px 14px;
          background: #181614;
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 8px;
          color: #fff;
          font-size: 15px;
          outline: none;
        }

        .field-dark:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
        }

        .error-box {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          margin-top: 10px;
          text-align: center;
        }

        .bottom-tagline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
          font-family: 'Cinzel', serif;
          font-size: 11px;
          letter-spacing: 4px;
          color: #8c8375;
        }

        .bottom-tagline .line {
          flex: 1;
          height: 1px;
          background: rgba(212, 175, 55, 0.25);
        }

        .sticky-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(18, 16, 14, 0.98);
          backdrop-filter: blur(12px);
          border-top: 1px solid rgba(212, 175, 55, 0.25);
          padding: 12px 18px calc(14px + env(safe-area-inset-bottom)) 56px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 99;
          box-shadow: 0 -6px 25px rgba(0, 0, 0, 0.7);
        }

        .footer-details { display: flex; flex-direction: column; }
        .footer-serv { font-size: 12px; color: #a8a092; }
        .gold-text { color: #d4af37; }
        .footer-time {
          font-size: 14.5px;
          color: #fff;
          font-family: 'Oswald', sans-serif;
          letter-spacing: 0.5px;
        }

        .btn-checkout {
          background: linear-gradient(135deg, #f7df87 0%, #d4af37 50%, #aa771c 100%);
          color: #12100e;
          border: none;
          padding: 12px 22px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 1px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
          transition: transform 0.15s ease;
        }

        .btn-checkout:active { transform: scale(0.98); }
        .btn-checkout.disabled {
          background: #25221e;
          color: #635c52;
          box-shadow: none;
          cursor: not-allowed;
        }

        .screen-center {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px 16px;
        }

        .ticket-card {
          max-width: 460px;
          width: 100%;
          background: #171513;
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 14px;
          padding: 30px 20px;
          text-align: center;
        }

        .check-gold {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f7df87, #aa771c);
          color: #12100e;
          font-size: 30px;
          font-weight: 900;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
        }

        .ticket-title { font-family: 'Cinzel', serif; font-size: 19px; margin-bottom: 8px; }
        .ticket-sub { font-size: 13.5px; color: #8c8375; margin-bottom: 20px; }

        .receipt-box {
          background: #100f0e;
          border: 1px dashed rgba(212, 175, 55, 0.3);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          font-size: 13.5px;
        }

        .r-row { display: flex; justify-content: space-between; }
        .r-row span { color: #8c8375; }

        .btn-whatsapp-action {
          display: block;
          width: 100%;
          padding: 15px;
          background: #25d366;
          color: #072a15;
          border-radius: 8px;
          font-weight: 800;
          font-size: 14.5px;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(37, 211, 102, 0.3);
        }

        .btn-secondary-link {
          background: transparent;
          border: 1px solid #3d3730;
          color: #bfb7aa;
          padding: 12px;
          border-radius: 8px;
          width: 100%;
          margin-top: 12px;
          font-size: 13px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}