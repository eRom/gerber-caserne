use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Wrap};
use ratatui::Frame;

use crate::process::LogLine;

pub struct AppState {
    pub mcp_logs: Vec<LogLine>,
    pub tunnel_logs: Vec<LogLine>,
    pub mcp_running: bool,
    pub tunnel_running: bool,
    pub last_build: Option<String>,
    pub focus: Pane,
    pub mcp_scroll: u16,
    pub tunnel_scroll: u16,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Pane {
    Mcp,
    Tunnel,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mcp_logs: Vec::new(),
            tunnel_logs: Vec::new(),
            mcp_running: false,
            tunnel_running: false,
            last_build: None,
            focus: Pane::Mcp,
            mcp_scroll: 0,
            tunnel_scroll: 0,
        }
    }

    pub fn scroll_down(&mut self) {
        match self.focus {
            Pane::Mcp => self.mcp_scroll = self.mcp_scroll.saturating_add(3),
            Pane::Tunnel => self.tunnel_scroll = self.tunnel_scroll.saturating_add(3),
        }
    }

    pub fn scroll_up(&mut self) {
        match self.focus {
            Pane::Mcp => self.mcp_scroll = self.mcp_scroll.saturating_sub(3),
            Pane::Tunnel => self.tunnel_scroll = self.tunnel_scroll.saturating_sub(3),
        }
    }

    pub fn auto_scroll_mcp(&mut self, area_height: u16) {
        let total = self.mcp_logs.len() as u16;
        if total > area_height.saturating_sub(2) {
            self.mcp_scroll = total - area_height.saturating_sub(2);
        }
    }

    pub fn auto_scroll_tunnel(&mut self, area_height: u16) {
        let total = self.tunnel_logs.len() as u16;
        if total > area_height.saturating_sub(2) {
            self.tunnel_scroll = total - area_height.saturating_sub(2);
        }
    }

    pub fn clear_logs(&mut self) {
        self.mcp_logs.clear();
        self.tunnel_logs.clear();
        self.mcp_scroll = 0;
        self.tunnel_scroll = 0;
    }
}

pub fn draw(f: &mut Frame, state: &AppState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // title bar
            Constraint::Min(5),   // log panes
            Constraint::Length(1), // status bar
        ])
        .split(f.area());

    draw_title_bar(f, chunks[0]);
    draw_log_panes(f, chunks[1], state);
    draw_status_bar(f, chunks[2], state);
}

fn draw_title_bar(f: &mut Frame, area: Rect) {
    let bar = Paragraph::new(Line::from(vec![
        Span::styled(
            " gerber admin ",
            Style::default()
                .fg(Color::Black)
                .bg(Color::Rgb(245, 158, 11)), // amber
        ),
        Span::raw("  "),
        Span::styled("[B]", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::raw("uild  "),
        Span::styled("[S]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::raw("tart/Stop  "),
        Span::styled("[Tab]", Style::default().fg(Color::Cyan)),
        Span::raw(" Focus  "),
        Span::styled("[C]", Style::default().fg(Color::Magenta).add_modifier(Modifier::BOLD)),
        Span::raw("lear  "),
        Span::styled("[W]", Style::default().fg(Color::Blue).add_modifier(Modifier::BOLD)),
        Span::raw("ebUI  "),
        Span::styled("[Q]", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::raw("uit"),
    ]))
    .style(Style::default().bg(Color::Rgb(30, 30, 30)));

    f.render_widget(bar, area);
}

fn draw_log_panes(f: &mut Frame, area: Rect, state: &AppState) {
    let panes = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // MCP pane
    let mcp_indicator = if state.mcp_running {
        Span::styled(" * RUNNING ", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))
    } else {
        Span::styled(" * STOPPED ", Style::default().fg(Color::Red))
    };

    let mcp_border_color = if state.focus == Pane::Mcp {
        Color::Rgb(245, 158, 11) // amber
    } else {
        Color::DarkGray
    };

    let mcp_lines: Vec<Line> = state
        .mcp_logs
        .iter()
        .map(|l| format_log_line(l))
        .collect();

    let mcp_block = Block::default()
        .title(vec![
            Span::raw(" MCP Server"),
            mcp_indicator,
        ])
        .borders(Borders::ALL)
        .border_style(Style::default().fg(mcp_border_color));

    let mcp_widget = Paragraph::new(mcp_lines)
        .block(mcp_block)
        .wrap(Wrap { trim: false })
        .scroll((state.mcp_scroll, 0));

    f.render_widget(mcp_widget, panes[0]);

    // Tunnel pane
    let tunnel_indicator = if state.tunnel_running {
        Span::styled(" * RUNNING ", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))
    } else {
        Span::styled(" * STOPPED ", Style::default().fg(Color::Red))
    };

    let tunnel_border_color = if state.focus == Pane::Tunnel {
        Color::Rgb(245, 158, 11)
    } else {
        Color::DarkGray
    };

    let tunnel_lines: Vec<Line> = state
        .tunnel_logs
        .iter()
        .map(|l| format_log_line(l))
        .collect();

    let tunnel_block = Block::default()
        .title(vec![
            Span::raw(" Cloudflare Tunnel"),
            tunnel_indicator,
        ])
        .borders(Borders::ALL)
        .border_style(Style::default().fg(tunnel_border_color));

    let tunnel_widget = Paragraph::new(tunnel_lines)
        .block(tunnel_block)
        .wrap(Wrap { trim: false })
        .scroll((state.tunnel_scroll, 0));

    f.render_widget(tunnel_widget, panes[1]);
}

fn format_log_line(l: &LogLine) -> Line<'_> {
    let ts = Span::styled(
        format!("{} ", l.timestamp),
        Style::default().fg(Color::DarkGray),
    );

    let text = l.text.as_str();

    // --> tool_call: name
    if text.starts_with("--> ") {
        return Line::from(vec![
            ts,
            Span::styled(
                text.to_string(),
                Style::default().fg(Color::Cyan),
            ),
        ]);
    }

    //   <-- result: OK / KO / Error
    if text.starts_with("  <-- ") {
        let color = if text.contains("OK") {
            Color::Green
        } else {
            Color::Red
        };
        return Line::from(vec![
            ts,
            Span::styled(text.to_string(), Style::default().fg(color)),
        ]);
    }

    // + session / - session
    if text.starts_with("+ session") {
        return Line::from(vec![
            ts,
            Span::styled(
                text.to_string(),
                Style::default().fg(Color::Green),
            ),
        ]);
    }
    if text.starts_with("- session") {
        return Line::from(vec![
            ts,
            Span::styled(
                text.to_string(),
                Style::default().fg(Color::Yellow),
            ),
        ]);
    }

    // !! auth failures
    if text.starts_with("!! ") {
        return Line::from(vec![
            ts,
            Span::styled(
                text.to_string(),
                Style::default()
                    .fg(Color::Red)
                    .add_modifier(Modifier::BOLD),
            ),
        ]);
    }

    // Default
    Line::from(vec![ts, Span::raw(text)])
}

fn draw_status_bar(f: &mut Frame, area: Rect, state: &AppState) {
    let mcp_status = if state.mcp_running {
        Span::styled("MCP * UP", Style::default().fg(Color::Green))
    } else {
        Span::styled("MCP * DOWN", Style::default().fg(Color::Red))
    };

    let tunnel_status = if state.tunnel_running {
        Span::styled("Tunnel * UP", Style::default().fg(Color::Green))
    } else {
        Span::styled("Tunnel * DOWN", Style::default().fg(Color::Red))
    };

    let build_status = match &state.last_build {
        Some(msg) => Span::styled(
            format!("Build: {msg}"),
            Style::default().fg(Color::Yellow),
        ),
        None => Span::styled("Build: -", Style::default().fg(Color::DarkGray)),
    };

    let bar = Paragraph::new(Line::from(vec![
        Span::raw("  "),
        mcp_status,
        Span::raw("  |  "),
        tunnel_status,
        Span::raw("  |  "),
        build_status,
    ]))
    .style(
        Style::default()
            .bg(Color::Rgb(30, 30, 30))
            .fg(Color::White),
    );

    f.render_widget(bar, area);
}
