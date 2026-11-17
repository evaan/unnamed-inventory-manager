dev:
    tmux new-session -s inventory-manager -c "{{justfile_directory()}}/backend" 'air' \; \
        split-window -h -c "{{justfile_directory()}}/frontend" 'bun run dev'

stop:
    tmux kill-session -t '=inventory-manager'
