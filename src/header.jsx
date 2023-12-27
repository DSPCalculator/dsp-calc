import React from 'react';
import { Navbar, Nav, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaReact, FaQq, FaInfoCircle } from 'react-icons/fa';

const Header = () => {
    const version = import.meta.env.VITE_APP_VERSION;
    const renderTooltip = (props) => (
        <Tooltip id="qq-tooltip" {...props}>
            联系作者QQ:653524123<br/>
            加入QQ群反馈:816367922
        </Tooltip>
    );
    return (
        <Navbar bg="light" expand="lg">
            <Navbar.Brand href="#" className="ms-3">
                <FaReact className="me-2" />戴森球计划量化计算器|
                <Navbar.Text className="text-muted">
                    v{version}
                </Navbar.Text>
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="navbarNav" />
            <Navbar.Collapse id="navbarNav">
                <Nav className="ml-auto">
                    <Nav.Link href="https://github.com/DSPCalculator/dsp-calc">开源仓库</Nav.Link>
                    <Nav.Link href="https://www.bilibili.com/read/readlist/rl630834" target="_blank">逻辑原理</Nav.Link>
                    <Nav.Link href="https://space.bilibili.com/16051534">联系作者</Nav.Link>
                </Nav>
                <Nav className="ml-auto">
                    <OverlayTrigger
                        placement="bottom"
                        delay={{ show: 250, hide: 400 }}
                        overlay={renderTooltip}
                    >
                        <Nav.Link href="#" className="d-flex align-items-center">
                            <FaQq className="mr-1" />
                            QQ
                        </Nav.Link>
                    </OverlayTrigger>
                </Nav>

            </Navbar.Collapse>
            <span className="navbar-text me-3">
                <FaInfoCircle/>若无法加载,尝试切换浏览器为Chrome/Edge
            </span>
        </Navbar>
    );
}

export default Header;