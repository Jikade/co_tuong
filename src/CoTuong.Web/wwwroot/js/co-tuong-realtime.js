window.coTuongRealtime = (() => {
    const connections = new Map();

    async function connect(roomId, component, key = "global") {
        if (!window.signalR) return false;
        await disconnect(key);
        const state = { connection: null, heartbeat: null, dotnet: component, roomId };
        connections.set(key, state);
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/hubs/room")
            .withAutomaticReconnect()
            .build();
        state.connection = connection;

        const notify = (name, ...args) => {
            if (roomId !== null && roomId !== undefined) state.dotnet?.invokeMethodAsync("OnRoomChanged").catch(() => {});
            else state.dotnet?.invokeMethodAsync("OnGlobalEvent", name, args[0] ?? {}).catch(() => {});
        };
        ["RoomStateChanged", "MemberJoined", "MemberLeft", "RoleChanged", "HostTransferred",
            "ReadyChanged", "RoomClosed", "MatchStarted", "InviteReceived", "InviteUpdated",
            "NotificationReceived", "PublicRoomsChanged"].forEach(name => connection.on(name, (...args) => notify(name, ...args)));

        connection.onreconnected(async () => {
            if (roomId !== null && roomId !== undefined) await connection.invoke("JoinRoom", roomId);
            notify("RoomStateChanged");
        });
        await connection.start();
        if (roomId !== null && roomId !== undefined) await connection.invoke("JoinRoom", roomId);
        state.heartbeat = window.setInterval(() => {
            if (connection.state === signalR.HubConnectionState.Connected) connection.invoke("Heartbeat").catch(() => {});
        }, 20000);
        return true;
    }

    async function disconnect(key = "global") {
        const state = connections.get(key);
        if (!state) return;
        if (state.heartbeat) window.clearInterval(state.heartbeat);
        await state.connection?.stop().catch(() => {});
        connections.delete(key);
    }

    return { connect, disconnect };
})();

window.coTuongClipboard = {
    copy: async value => navigator.clipboard.writeText(value)
};
